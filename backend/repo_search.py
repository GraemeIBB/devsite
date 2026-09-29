import os
import json
import re
import shutil
import time
import subprocess
import requests
import xml.etree.ElementTree as ET

REPOS_FILE = os.path.join(os.path.dirname(__file__), "data", "repos.json")
CLONE_DIR = os.path.join(os.path.dirname(__file__), "data", "repos")
FEATURES_FILE = os.path.join(os.path.dirname(__file__), "data", "features.json")

# feature -> what marks a repo as having it: dependency names (matched against
# manifest files) and/or paths (files/dirs) that exist at the repo root. add an
# entry here and every synced repo gets checked for it automatically.
FEATURE_RULES = {
    "auth": {
        "deps": ["passport", "next-auth", "jsonwebtoken", "flask-login",
                  "flask-jwt-extended", "authlib", "oauthlib", "django-allauth",
                  "devise", "jwt", "python-jose"],
        "paths": ["auth", "authentication", "middleware/auth"],
    },
    "payments": {
        "deps": ["stripe", "braintree", "paypal-rest-sdk", "square"],
        "paths": ["billing", "payments"],
    },
    "database": {
        "deps": ["sqlalchemy", "prisma", "mongoose", "sequelize", "typeorm",
                  "psycopg2", "pymongo", "django"],
        "paths": ["models", "migrations", "db"],
    },
    "testing": {
        "deps": ["pytest", "jest", "mocha", "vitest", "rspec"],
        "paths": ["tests", "test", "__tests__", "spec"],
    },
    "ci": {
        "paths": [".github/workflows", ".circleci", ".gitlab-ci.yml"],
    },
    "docker": {
        "paths": ["Dockerfile", "docker-compose.yml", "docker-compose.yaml"],
    },
    "websockets": {
        "deps": ["socket.io", "ws", "flask-socketio", "channels", "websockets"],
    },
}


def load_repo_list():
    try:
        with open(REPOS_FILE) as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return []


def find_repo(repo_id):
    return next((e for e in load_repo_list() if e.get("id") == repo_id), None)


def _clone_path(entry):
    return os.path.join(CLONE_DIR, entry["id"])


def _run_git(args, cwd=None):
    # maintained list is public repos only for now — no auth needed, and
    # sending GH_TOKEN here would wrongly couple this to the stats feature's
    # token (data.py), which only has read:user, not repo content access.
    result = subprocess.run(["git", *args], cwd=cwd, capture_output=True, text=True, timeout=120)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or f"git {' '.join(args)} failed ({result.returncode})")
    return result


def sync_repos():
    os.makedirs(CLONE_DIR, exist_ok=True)
    features = {}
    for entry in load_repo_list():
        repo_id, owner, repo = entry["id"], entry["owner"], entry["repo"]
        ref = entry.get("ref", "main")
        path = _clone_path(entry)
        try:
            if os.path.isdir(os.path.join(path, ".git")):
                _run_git(["fetch", "--depth", "1", "origin", ref], cwd=path)
                _run_git(["reset", "--hard", f"origin/{ref}"], cwd=path)
            else:
                url = f"https://github.com/{owner}/{repo}.git"
                _run_git(["clone", "--depth", "1", "--branch", ref, url, path])
            features[repo_id] = {
                "owner": owner,
                "repo": repo,
                "tags": detect_features(path),
                "syncedAt": int(time.time()),
            }
        except Exception as e:
            features[repo_id] = {"owner": owner, "repo": repo, "tags": [], "error": str(e)}
    save_features(features)
    _prune_orphaned_clones(features.keys())


# removes clone dirs for ids no longer in repos.json (renamed or deleted from
# the maintained list) — keeps disk usage tied to the current list, not to
# every id that's ever been in it.
def _prune_orphaned_clones(live_ids):
    live_ids = set(live_ids)
    for name in os.listdir(CLONE_DIR):
        if name not in live_ids:
            shutil.rmtree(os.path.join(CLONE_DIR, name), ignore_errors=True)


def detect_features(repo_path):
    deps = _collect_deps(repo_path)
    tags = []
    for name, rule in FEATURE_RULES.items():
        hit = any(d in deps for d in rule.get("deps", []))
        if not hit:
            hit = any(os.path.exists(os.path.join(repo_path, p)) for p in rule.get("paths", []))
        if hit:
            tags.append(name)
    return sorted(tags)


# dirs never worth descending into for manifests — vendored/generated code,
# not the repo's own declared deps
_SKIP_DIRS = {".git", "node_modules", "third_party", "vendor", "venv", ".venv", "build", "dist", "__pycache__"}


def _find_files(repo_path, filename):
    for root, dirs, files in os.walk(repo_path):
        dirs[:] = [d for d in dirs if d not in _SKIP_DIRS]
        if filename in files:
            yield os.path.join(root, filename)


def _collect_deps(repo_path):
    # manifests can live anywhere in the tree, not just the root — a ROS2
    # workspace (ros2_ws/src/<pkg>/package.xml) or JS monorepo never puts one
    # at the top level
    deps = set()

    for pkg in _find_files(repo_path, "package.json"):
        try:
            with open(pkg) as f:
                data = json.load(f)
            deps |= set(data.get("dependencies", {}).keys())
            deps |= set(data.get("devDependencies", {}).keys())
        except json.JSONDecodeError:
            pass

    for req in _find_files(repo_path, "requirements.txt"):
        with open(req) as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                name = line.split("==")[0].split(">=")[0].split("[")[0].strip()
                if name:
                    deps.add(name)

    # c++ has no one dominant manifest — CMake's find_package() calls are the
    # most common signal across repos regardless of which package manager (if
    # any) they use
    for cmake in _find_files(repo_path, "CMakeLists.txt"):
        with open(cmake) as f:
            deps |= set(re.findall(r"find_package\(\s*([A-Za-z0-9_]+)", f.read(), re.IGNORECASE))

    # ROS's manifest format — <depend>/<build_depend>/<exec_depend>/<run_depend>
    for pkgxml in _find_files(repo_path, "package.xml"):
        try:
            root = ET.parse(pkgxml).getroot()
            for tag in ("depend", "build_depend", "exec_depend", "run_depend", "test_depend"):
                for el in root.findall(tag):
                    if el.text:
                        deps.add(el.text.strip())
        except ET.ParseError:
            pass

    return {d.lower() for d in deps}


def load_features():
    try:
        with open(FEATURES_FILE) as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def save_features(features):
    os.makedirs(os.path.dirname(FEATURES_FILE), exist_ok=True)
    with open(FEATURES_FILE, "w") as f:
        json.dump(features, f, indent=2)


def search_code(query, repo_id=None, limit=30):
    if not query:
        return []
    base_dir = CLONE_DIR
    if repo_id:
        entry = find_repo(repo_id)
        if not entry:
            return []
        base_dir = _clone_path(entry)
        if not os.path.isdir(base_dir):
            return []
    try:
        result = subprocess.run(
            ["rg", "--no-heading", "--line-number", "--ignore-case", query, base_dir],
            capture_output=True, text=True, timeout=15,
        )
    except FileNotFoundError:
        return []

    hits = []
    for line in result.stdout.splitlines()[:limit]:
        path, _, rest = line.partition(":")
        lineno, _, text = rest.partition(":")
        if not lineno.isdigit():
            continue
        rel = os.path.relpath(path, CLONE_DIR)
        repo_id_part, _, file_path = rel.partition(os.sep)
        hits.append({
            "repo": repo_id_part,
            "file": file_path,
            "line": int(lineno),
            "text": text.strip(),
        })
    return hits


# GitHub's REST API has no direct "total commits" field — the standard trick
# is reading the last-page number off the paginated /commits Link header
# instead of walking every page.
def _commit_count(owner, repo, ref):
    try:
        r = requests.get(
            f"https://api.github.com/repos/{owner}/{repo}/commits",
            params={"sha": ref, "per_page": 1},
            timeout=10,
        )
        r.raise_for_status()
        m = re.search(r'page=(\d+)>; rel="last"', r.headers.get("Link", ""))
        return int(m.group(1)) if m else len(r.json())
    except Exception:
        return None


def _languages(owner, repo):
    try:
        r = requests.get(f"https://api.github.com/repos/{owner}/{repo}/languages", timeout=10)
        r.raise_for_status()
        return list(r.json().keys())
    except Exception:
        return []


def summarize_repo(repo_id):
    entry = find_repo(repo_id)
    if not entry:
        return {"error": f'no repo with id "{repo_id}"'}
    owner, repo, ref = entry["owner"], entry["repo"], entry.get("ref", "main")
    path = _clone_path(entry)
    if not os.path.isdir(path):
        return {"error": f'"{repo_id}" hasn\'t been synced yet'}

    return {
        "id": repo_id,
        "owner": owner,
        "repo": repo,
        "languages": _languages(owner, repo),
        "deps": sorted(_collect_deps(path)),
        "tags": detect_features(path),
        "commits": _commit_count(owner, repo, ref),
        "url": f"https://github.com/{owner}/{repo}",
    }


_SOURCE_EXTS = {".py", ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs",
                 ".c", ".cc", ".cpp", ".cxx", ".h", ".hpp", ".hxx"}

# one generic "what does this file reference" pattern per import style —
# deliberately not exhaustive (no `#include <system>`, no dynamic imports),
# just the common literal-path/module forms that show up everywhere
_REF_PATTERNS = [
    re.compile(r"^\s*from\s+([\w.]+)\s+import", re.MULTILINE),        # python
    re.compile(r"^\s*import\s+([\w.,\s]+)", re.MULTILINE),            # python
    re.compile(r"""(?:import\s[^;\n]*?from\s+|require\()\s*['"]([^'"]+)['"]"""),  # js/ts
    re.compile(r'#include\s*"([^"]+)"'),                              # c/c++ local includes
]


def _build_basename_index(repo_path):
    # maps a bare filename (with and without extension) -> the repo-relative
    # paths of files with that name, so a reference can be resolved without
    # caring which language's path/module conventions produced it
    index = {}
    for root, dirs, files in os.walk(repo_path):
        dirs[:] = [d for d in dirs if d not in _SKIP_DIRS]
        for fname in files:
            rel = os.path.relpath(os.path.join(root, fname), repo_path)
            index.setdefault(fname, []).append(rel)
            index.setdefault(os.path.splitext(fname)[0], []).append(rel)
    return index


def _resolve_ref(ref, index):
    ref = ref.strip()
    if not ref:
        return None
    last = ref.rstrip("/").split("/")[-1]
    candidates = index.get(last) or index.get(os.path.splitext(last)[0])
    if not candidates and "/" not in ref and "." in last:
        # dotted python import (pkg.module) with no path separator at all —
        # fall back to its last dotted segment as a bare name
        candidates = index.get(last.split(".")[-1])
    return candidates[0] if candidates and len(candidates) == 1 else None


def map_repo(repo_id, limit=150):
    entry = find_repo(repo_id)
    if not entry:
        return {"error": f'no repo with id "{repo_id}"'}
    path = _clone_path(entry)
    if not os.path.isdir(path):
        return {"error": f'"{repo_id}" hasn\'t been synced yet'}

    index = _build_basename_index(path)
    edges = set()
    file_count = 0
    for root, dirs, files in os.walk(path):
        dirs[:] = [d for d in dirs if d not in _SKIP_DIRS]
        for fname in files:
            if os.path.splitext(fname)[1] not in _SOURCE_EXTS:
                continue
            file_count += 1
            full = os.path.join(root, fname)
            rel = os.path.relpath(full, path)
            try:
                with open(full, errors="ignore") as f:
                    text = f.read()
            except OSError:
                continue
            refs = set()
            for pat in _REF_PATTERNS:
                for raw in pat.findall(text):
                    for piece in raw.split(","):
                        piece = piece.strip()
                        if piece:
                            refs.add(piece)
            for ref in refs:
                target = _resolve_ref(ref, index)
                if target and target != rel:
                    edges.add((rel, target))

    edge_list = sorted(edges)
    return {
        "id": repo_id,
        "fileCount": file_count,
        "edgeCount": len(edge_list),
        "edges": edge_list[:limit],
        "truncated": len(edge_list) > limit,
    }
