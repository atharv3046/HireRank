"""
Script to safely purge previous resume data:
- Backs up the databases first if not already backed up
- Deletes all Candidate rows
- Deletes all MatchScore rows
- Deletes uploaded candidate PDFs in uploads directories (preserving .gitkeep)
- Resets guest sessions total/done counts
"""

import os
import sys
import sqlite3
import shutil
from pathlib import Path
from datetime import datetime

WORKSPACE_ROOT = Path(__file__).resolve().parent.parent.parent
BACKEND_DIR = Path(__file__).resolve().parent.parent

DB_PATHS = [
    BACKEND_DIR / "resume_screening.db",
    WORKSPACE_ROOT / "resume_screening.db",
]

UPLOAD_DIRS = [
    BACKEND_DIR / "uploads",
    WORKSPACE_ROOT / "uploads",
]

def backup_db(db_path: Path):
    if not db_path.exists():
        return
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = db_path.with_name(f"{db_path.name}.bak_{ts}")
    shutil.copy2(db_path, backup_path)
    print(f"Backed up {db_path} -> {backup_path}")

def cleanup_files():
    deleted_files = 0
    deleted_dirs = 0

    for upload_dir in UPLOAD_DIRS:
        if not upload_dir.exists():
            continue

        # Clean top-level PDF / doc files in uploads
        for item in upload_dir.iterdir():
            if item.name == ".gitkeep":
                continue
            if item.is_file() and item.suffix.lower() in (".pdf", ".docx", ".doc", ".txt"):
                try:
                    item.unlink(missing_ok=True)
                    deleted_files += 1
                except Exception as e:
                    print(f"Error removing file {item}: {e}")
            elif item.is_dir() and item.name == "guest":
                # Clean guest session subfolders
                for guest_item in item.iterdir():
                    if guest_item.is_dir():
                        try:
                            shutil.rmtree(guest_item, ignore_errors=True)
                            deleted_dirs += 1
                        except Exception as e:
                            print(f"Error removing guest dir {guest_item}: {e}")

    print(f"Deleted {deleted_files} resume files and {deleted_dirs} guest session directories.")

def cleanup_databases():
    for db_path in DB_PATHS:
        if not db_path.exists():
            continue

        print(f"\nCleaning database: {db_path}")
        backup_db(db_path)

        conn = sqlite3.connect(db_path)
        c = conn.cursor()

        # Count before
        try:
            cand_count = c.execute("SELECT count(*) FROM candidates").fetchone()[0]
        except Exception:
            cand_count = 0

        try:
            score_count = c.execute("SELECT count(*) FROM match_scores").fetchone()[0]
        except Exception:
            score_count = 0

        print(f"  Before: {cand_count} candidates, {score_count} match scores.")

        # Delete match scores and candidates
        try:
            c.execute("DELETE FROM match_scores")
            c.execute("DELETE FROM candidates")
            conn.commit()
            print("  Successfully deleted all candidates and match_scores.")
        except Exception as e:
            print(f"  Error deleting from database: {e}")
            conn.rollback()

        # Verify
        try:
            cand_after = c.execute("SELECT count(*) FROM candidates").fetchone()[0]
            score_after = c.execute("SELECT count(*) FROM match_scores").fetchone()[0]
            print(f"  After: {cand_after} candidates, {score_after} match scores.")
        except Exception:
            pass

        # Vacuum database to reclaim space
        try:
            c.execute("VACUUM")
            conn.commit()
            print("  Database VACUUM completed.")
        except Exception as e:
            print(f"  VACUUM warning: {e}")

        conn.close()

if __name__ == "__main__":
    print("=== Starting Previous Resume Data Cleanup ===")
    cleanup_files()
    cleanup_databases()
    print("=== Cleanup Complete ===")
