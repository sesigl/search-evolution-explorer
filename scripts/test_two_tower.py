"""Behaviour checks for training, without reading or changing committed artifacts."""
import importlib.util
import unittest
from pathlib import Path

import torch

spec = importlib.util.spec_from_file_location("train_two_tower", Path(__file__).with_name("train-two-tower.py"))
trainer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(trainer)


class TwoTowerTrainingTest(unittest.TestCase):
    def test_given_query_splits_when_pairs_are_sampled_then_test_judgments_are_excluded(self):
        judgments = [{"queryText": query, "itemId": item, "grade": grade}
                     for query in ["train", "validation", "test"]
                     for item, grade in [("positive", 3), ("negative", 0)]]
        pairs = trainer.make_pairs(judgments, {"train": 0, "validation": 1, "test": 2},
                                   {"positive": 0, "negative": 1},
                                   {"train": "train", "validation": "validation", "test": "test"}, "train")
        self.assertEqual(pairs.tolist(), [[0, 0, 1, 1]])

    def test_given_a_wrong_order_when_both_heads_learn_then_the_click_moves_above_the_skip(self):
        torch.manual_seed(42)
        query_head = torch.nn.Linear(2, 2, bias=False)
        item_head = torch.nn.Linear(2, 2, bias=False)
        queries = torch.tensor([[1.0, 0.0]])
        documents = torch.tensor([[0.0, 1.0], [1.0, 0.0]])
        with torch.no_grad():
            query_head.weight.copy_(torch.eye(2))
            item_head.weight.copy_(torch.eye(2))
        pairs = torch.tensor([[0.0, 0.0, 1.0, 1.0]])
        before = trainer.pair_loss(pairs, queries, documents, query_head, item_head).item()
        optimizer = torch.optim.AdamW(list(query_head.parameters()) + list(item_head.parameters()), lr=0.1)
        for _ in range(20):
            optimizer.zero_grad()
            loss = trainer.pair_loss(pairs, queries, documents, query_head, item_head)
            loss.backward()
            optimizer.step()
        after = trainer.pair_loss(pairs, queries, documents, query_head, item_head).item()
        self.assertGreater(before, 10)
        self.assertLess(after, 0.01)
        self.assertFalse(torch.equal(query_head.weight, torch.eye(2)))
        self.assertFalse(torch.equal(item_head.weight, torch.eye(2)))


if __name__ == "__main__":
    unittest.main()
