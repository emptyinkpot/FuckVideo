import argparse
import json

from .store import ingest_seed


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest material seed JSONL into LanceDB.")
    parser.add_argument("--seed", required=True)
    parser.add_argument("--db", required=True)
    args = parser.parse_args()
    print(json.dumps(ingest_seed(args.seed, args.db), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
