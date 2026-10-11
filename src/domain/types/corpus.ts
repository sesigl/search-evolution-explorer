export interface Category {
  readonly id: string;
  readonly label: string;
}

export interface CorpusItem {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly categoryId: string;
  readonly priceCents: number;
  readonly location: string;
  readonly postedAt: string;
  readonly available: boolean;
}
