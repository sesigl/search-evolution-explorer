"""Supervised two-tower training. Prepared input contains no test-query judgments."""
import copy
import hashlib
import json
import random
from pathlib import Path

import numpy as np
import torch
from torch import nn
from torch.nn import functional as F

SEED = 42
OUTPUT_DIM = 96
TEMPERATURE = 0.1
EPOCHS = 8
BATCH_SIZE = 256
LEARNING_RATE = 0.0001
ANCHOR_WEIGHT = 50.0
TITLE_WEIGHT = 0.8


def make_pairs(judgments, query_ids, item_ids, split_by_query, split):
    """A judged higher grade beats a lower grade; skips are not negative labels."""
    rng = random.Random(SEED)
    grouped = {}
    for row in judgments:
        query = row["queryText"]
        if split_by_query[query] == split and row["itemId"] in item_ids:
            grouped.setdefault(query, {})[row["itemId"]] = row["grade"]
    pairs = []
    for query, grades in sorted(grouped.items()):
        candidates = [(positive, negative, (2 ** pg - 2 ** ng) / 7)
                      for positive, pg in grades.items() for negative, ng in grades.items() if pg > ng]
        rng.shuffle(candidates)
        for positive, negative, weight in candidates[:256]:
            pairs.append((query_ids[query], item_ids[positive], item_ids[negative], weight))
    if not pairs:
        raise ValueError(f"No graded preferences in {split} split")
    return torch.tensor(pairs, dtype=torch.float32)


def pair_loss(pairs, queries, documents, query_head, item_head):
    query = F.normalize(query_head(queries[pairs[:, 0].long()]), dim=1)
    positive = F.normalize(item_head(documents[pairs[:, 1].long()]), dim=1)
    negative = F.normalize(item_head(documents[pairs[:, 2].long()]), dim=1)
    margin = (query * (positive - negative)).sum(dim=1) / TEMPERATURE
    weights = pairs[:, 3]
    return (weights * F.softplus(-margin)).sum() / weights.sum()


def validation_ndcg(judgments, queries, documents, query_ids, item_ids, split_by_query, query_head, item_head):
    grouped = {}
    for row in judgments:
        if split_by_query[row["queryText"]] == "validation":
            grouped.setdefault(row["queryText"], {})[item_ids[row["itemId"]]] = row["grade"]
    query_vectors = F.normalize(query_head(queries), dim=1)
    item_vectors = F.normalize(item_head(documents), dim=1)
    scores = query_vectors @ item_vectors.T
    results = []
    discount = 1 / np.log2(np.arange(2, 12))
    for query, grades in grouped.items():
        order = torch.argsort(scores[query_ids[query]], descending=True, stable=True)[:10].tolist()
        gains = [(2 ** grades.get(index, 0) - 1) for index in order]
        ideal = sorted((2 ** grade - 1 for grade in grades.values()), reverse=True)[:10]
        denominator = sum(gain * discount[i] for i, gain in enumerate(ideal))
        results.append(sum(gain * discount[i] for i, gain in enumerate(gains)) / denominator if denominator else 0)
    return float(np.mean(results))


def main():
    torch.manual_seed(SEED)
    torch.set_num_threads(1)
    torch.use_deterministic_algorithms(True)
    data = json.loads(Path(".cache/two-tower/training.json").read_text())
    manifest = json.loads(Path("data/embeddings.manifest.json").read_text())
    query_ids = {row["query"]: index for index, row in enumerate(data["queries"])}
    item_ids = {item: index for index, item in enumerate(manifest["itemIds"])}
    splits = {row["query"]: row["split"] for row in data["queries"]}
    if any(splits[row["queryText"]] == "test" for row in data["judgments"]):
        raise ValueError("Test judgments must not enter training or validation")
    queries = torch.tensor([row["vector"] for row in data["queries"]])
    base = torch.from_numpy(np.fromfile("data/embeddings.bin", dtype="<f4").reshape(-1, manifest["dimensions"]).copy())
    # Descriptions in this inventory often contain off-topic text. Keep title information prominent.
    documents = F.normalize(TITLE_WEIGHT * torch.tensor(data["titles"]) + (1 - TITLE_WEIGHT) * base, dim=1)
    train = make_pairs(data["judgments"], query_ids, item_ids, splits, "train")
    validation = make_pairs(data["judgments"], query_ids, item_ids, splits, "validation")
    # Inventory-only SVD initializes a shared semantic subspace; delta regularization preserves it.
    _, _, vh = torch.linalg.svd(documents, full_matrices=False)
    initial = vh[:OUTPUT_DIM].clone()
    query_head = nn.Linear(manifest["dimensions"], OUTPUT_DIM, bias=False)
    with torch.no_grad():
        query_head.weight.copy_(initial)
    item_head = copy.deepcopy(query_head)
    optimizer = torch.optim.AdamW(list(query_head.parameters()) + list(item_head.parameters()), lr=LEARNING_RATE, weight_decay=0.01)
    best_ndcg = -1
    best = None
    history = []
    for epoch in range(EPOCHS + 1):
        if epoch > 0:
            for batch in torch.randperm(len(train)).split(BATCH_SIZE):
                optimizer.zero_grad()
                anchor = ((query_head.weight - initial) ** 2).mean() + ((item_head.weight - initial) ** 2).mean()
                loss = pair_loss(train[batch], queries, documents, query_head, item_head) + ANCHOR_WEIGHT * anchor
                loss.backward()
                optimizer.step()
        with torch.no_grad():
            ndcg = validation_ndcg(data["judgments"], queries, documents, query_ids, item_ids, splits, query_head, item_head)
            validation_loss = pair_loss(validation, queries, documents, query_head, item_head).item()
        history.append({"epoch": epoch, "validationLoss": validation_loss, "validationNdcgAt10": ndcg})
        print(f"epoch={epoch} validationNdcg={ndcg:.6f} validationLoss={validation_loss:.6f}", flush=True)
        if ndcg > best_ndcg:
            best_ndcg = ndcg
            best = (epoch, copy.deepcopy(query_head.state_dict()), copy.deepcopy(item_head.state_dict()))
    selected_epoch, query_state, item_state = best
    if selected_epoch == 0:
        raise ValueError("Training did not improve validation retrieval NDCG")
    query_head.load_state_dict(query_state)
    item_head.load_state_dict(item_state)
    with torch.no_grad():
        vectors = F.normalize(item_head(documents), dim=1).numpy().astype("<f4")
        query_vectors = F.normalize(query_head(queries), dim=1).numpy()
    output = Path("data/models/two-tower")
    output.mkdir(parents=True, exist_ok=True)
    model = {"queryWeights": query_head.weight.tolist(), "itemWeights": item_head.weight.tolist()}
    (output / "model.json").write_text(json.dumps(model, separators=(",", ":")) + "\n")
    vectors.tofile(output / "items.bin")
    metadata = {
        "version": 1, "dimensions": OUTPUT_DIM, "inputDimensions": manifest["dimensions"],
        "itemIds": manifest["itemIds"], "inputs": data["inputs"],
        "files": {name: hashlib.sha256((output / name).read_bytes()).hexdigest() for name in ["model.json", "items.bin"]},
        "splits": {split: [q for q, value in splits.items() if value == split] for split in ["train", "validation", "test"]},
        "training": {"seed": SEED, "epochs": EPOCHS, "selectedEpoch": selected_epoch, "learningRate": LEARNING_RATE,
                     "batchSize": BATCH_SIZE, "temperature": TEMPERATURE, "anchorWeight": ANCHOR_WEIGHT,
                     "titleWeight": TITLE_WEIGHT, "supervision": "training-query relevance judgments",
                     "trainPairs": len(train), "validationPairs": len(validation), "validationHistory": history,
                     "torchVersion": torch.__version__, "numpyVersion": np.__version__},
        "parity": {"input": queries[0].tolist(), "output": query_vectors[0].tolist()},
    }
    (output / "manifest.json").write_text(json.dumps(metadata, indent=2) + "\n")
    print(f"Wrote trained heads and {len(vectors)} item vectors; selected epoch {selected_epoch} using validation judgments only.")


if __name__ == "__main__":
    main()
