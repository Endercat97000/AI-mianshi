"""Offline backups. Restore to a NEW directory; never overwrite live user data."""
import argparse
import json
import shutil
import sqlite3
import sys
import tempfile
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from backend.database import DATA_DIR
from backend.runtime_lock import data_lock


def backup(source: Path, destination: Path):
    destination = destination.resolve()
    if destination.exists():
        raise ValueError("备份目标已存在，请指定新文件。")
    if destination.is_relative_to(source.resolve()):
        raise ValueError("请将备份放在数据目录之外。")
    with data_lock(source), tempfile.TemporaryDirectory() as temp:
        db_path = Path(temp) / "app.db"
        source_db = sqlite3.connect((source / "app.db").resolve().as_uri() + "?mode=ro", uri=True)
        copy = sqlite3.connect(db_path)
        try:
            source_db.backup(copy)
            copy.execute("PRAGMA secure_delete=ON")
            copy.execute("UPDATE settings SET api_key='' WHERE id=1")
            copy.commit()
            copy.execute("VACUUM")
            files = [row[0] for row in copy.execute("SELECT file_path FROM resumes")]
        finally:
            copy.close()
            source_db.close()
        resolved = []
        for relative in files:
            path = (source / relative).resolve()
            if not path.is_relative_to((source / "resumes").resolve()) or not path.is_file():
                raise ValueError("数据库引用了不存在或越界的简历文件。")
            resolved.append((relative, path))
        destination.parent.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(destination, "x", zipfile.ZIP_DEFLATED) as archive:
            archive.write(db_path, "app.db")
            archive.writestr("manifest.json", json.dumps({"version": 1, "secrets_included": False}))
            for relative, path in resolved:
                archive.write(path, relative)
    return destination


def restore(archive_path: Path, destination: Path):
    destination = destination.resolve()
    if destination.exists():
        raise ValueError("恢复目标必须是一个不存在的新目录，避免覆盖现有数据。")
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=destination.parent) as temp:
        staged = Path(temp)
        with zipfile.ZipFile(archive_path) as archive:
            if sum(i.file_size for i in archive.infolist()) > 1024 * 1024 * 1024:
                raise ValueError("备份解压内容超过 1 GB。")
            if len(set(archive.namelist())) != len(archive.namelist()):
                raise ValueError("备份含重复路径。")
            for item in archive.infolist():
                path = (staged / item.filename).resolve()
                allowed = item.filename in ("app.db", "manifest.json") or (item.filename.startswith("resumes/") and len(Path(item.filename).parts) == 2)
                if not path.is_relative_to(staged.resolve()) or not allowed or "\\" in item.filename:
                    raise ValueError("备份含不合法路径。")
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(archive.read(item))
        manifest = json.loads((staged / "manifest.json").read_text())
        if manifest.get("version") != 1:
            raise ValueError("不支持的备份版本。")
        db = sqlite3.connect(staged / "app.db")
        try:
            if db.execute("PRAGMA integrity_check").fetchone()[0] != "ok" or db.execute("PRAGMA foreign_key_check").fetchall():
                raise ValueError("备份数据库校验失败。")
            for table in ("projects", "candidates", "resumes", "settings"):
                db.execute(f"SELECT 1 FROM {table} LIMIT 1")
            for (relative,) in db.execute("SELECT file_path FROM resumes"):
                path = (staged / relative).resolve()
                if not path.is_relative_to((staged / "resumes").resolve()) or not path.is_file():
                    raise ValueError("备份缺少简历文件或路径越界。")
            db.execute("PRAGMA secure_delete=ON")
            db.execute("UPDATE settings SET api_key='' WHERE id=1")
            db.commit()
            db.execute("VACUUM")
        finally:
            db.close()
        (staged / "manifest.json").unlink()
        (staged / "resumes").mkdir(exist_ok=True)
        (staged / "candidates").mkdir(exist_ok=True)
        # destination is checked absent; copy into a new directory only.
        shutil.copytree(staged, destination)
    return destination


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("operation", choices=["backup", "restore"])
    parser.add_argument("path", type=Path, help="backup output ZIP or restore input ZIP")
    parser.add_argument("--target", type=Path, help="restore destination (must not exist)")
    args = parser.parse_args()
    try:
        if args.operation == "backup":
            print(backup(DATA_DIR, args.path))
        else:
            if args.target is None:
                parser.error("restore requires --target")
            print(restore(args.path, args.target))
            print("恢复完成。设置 AI_INTERVIEW_DATA_DIR 指向新目录后重启，并重新填写 API Key。")
    except (ValueError, RuntimeError, OSError, sqlite3.Error, zipfile.BadZipFile) as error:
        parser.exit(1, str(error) + "\n")

if __name__ == "__main__":
    main()
