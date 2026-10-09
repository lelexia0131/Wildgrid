"""Run through SSH stdin; only update Wildgrid files and the existing 8080 server."""
import hashlib
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime, timezone

DIRECTORY = Path('/var/www/Wildgrid')
CONFIG = Path('/etc/nginx/sites-available/fiverealms-download')
BEGIN = '    # BEGIN WILDGRID DOWNLOADS'
END = '    # END WILDGRID DOWNLOADS'
LOCATIONS = '''    # BEGIN WILDGRID DOWNLOADS
    location = /Wildgrid.exe {
        alias /var/www/Wildgrid/Wildgrid.exe;
        types { }
        default_type application/octet-stream;
        add_header Content-Disposition 'attachment; filename="Wildgrid.exe"' always;
        add_header X-Content-Type-Options nosniff;
    }

    location = /Wildgrid.apk {
        alias /var/www/Wildgrid/Wildgrid.apk;
        types { }
        default_type application/vnd.android.package-archive;
        add_header Content-Disposition 'attachment; filename="Wildgrid.apk"' always;
        add_header X-Content-Type-Options nosniff;
    }
    # END WILDGRID DOWNLOADS'''


def replace_config(content, metadata):
    # Replace the actual sites-available file, keeping the sites-enabled symlink.
    fd, name = tempfile.mkstemp(prefix='.wildgrid-', dir=CONFIG.parent)
    try:
        with os.fdopen(fd, 'wb') as output:
            output.write(content)
            os.fchmod(output.fileno(), metadata.st_mode & 0o777)
            os.fchown(output.fileno(), metadata.st_uid, metadata.st_gid)
        os.replace(name, CONFIG)
    finally:
        Path(name).unlink(missing_ok=True)


def publish(token, hashes):
    uploads = [DIRECTORY / f'.{name}.{token}.upload' for name in ('Wildgrid.exe', 'Wildgrid.apk')]
    for upload, expected in zip(uploads, hashes):
        with upload.open('rb') as content:
            actual = hashlib.file_digest(content, 'sha256').hexdigest()
        if upload.stat().st_size == 0 or actual != expected:
            raise RuntimeError(f'Uploaded content check failed: {upload.name}')
    original = CONFIG.read_bytes()
    text = original.decode('utf-8')
    if BEGIN in text or END in text:
        if text.count(BEGIN) != 1 or text.count(END) != 1:
            raise RuntimeError('Invalid Wildgrid configuration markers')
        text = re.sub(re.escape(BEGIN) + r'.*?' + re.escape(END), lambda _: LOCATIONS, text, flags=re.S)
    else:
        if len(re.findall(r'(?m)^\s*server\s*\{', text)) != 1 or not re.search(r'listen\s+8080\s*;', text) or not text.rstrip().endswith('}'):
            raise RuntimeError('Expected the existing single FiveRealms 8080 server')
        if re.search(r'location\s+=\s+/Wildgrid\.(exe|apk)', text):
            raise RuntimeError('Unmanaged Wildgrid locations already exist; inspect before replacing')
        text = text.rstrip()[:-1] + '\n' + LOCATIONS + '\n}\n'
    updated = text.encode('utf-8')
    changed = updated != original
    metadata = CONFIG.stat()
    if changed:
        stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
        backup = Path('/var/backups/wildgrid-download') / f'{stamp}-{token}'
        backup.mkdir(parents=True, mode=0o700)
        shutil.copy2(CONFIG, backup / CONFIG.name)
        print(f'Nginx backup: {backup / CONFIG.name}', flush=True)
    try:
        if changed:
            replace_config(updated, metadata)
        subprocess.run(['nginx', '-t'], check=True)
        for name, upload in zip(('Wildgrid.exe', 'Wildgrid.apk'), uploads):
            upload.chmod(0o644)
            os.replace(upload, DIRECTORY / name)
        if changed:
            subprocess.run(['systemctl', 'reload', 'nginx'], check=True)
        print('Installers replaced atomically; Nginx configuration passed.', flush=True)
    except BaseException:
        if changed:
            replace_config(original, metadata)
            subprocess.run(['nginx', '-t'], check=True)
            subprocess.run(['systemctl', 'reload', 'nginx'], check=True)
            print('Restored original Nginx configuration.', flush=True)
        raise


def main():
    action, token = sys.argv[1:3]
    if not re.fullmatch(r'[0-9a-f-]{36}', token):
        raise RuntimeError('Invalid upload token')
    if os.geteuid() != 0:
        raise RuntimeError('Use the existing root SSH alias for Nginx deployment')
    if action == 'prepare':
        subprocess.run(['nginx', '-t'], check=True)
        DIRECTORY.mkdir(exist_ok=True, mode=0o755)
        DIRECTORY.chmod(0o755)
    elif action == 'publish':
        hashes = sys.argv[3:5]
        if len(hashes) != 2 or not all(re.fullmatch(r'[0-9a-f]{64}', value) for value in hashes):
            raise RuntimeError('Expected two SHA-256 digests')
        publish(token, hashes)
    elif action == 'cleanup':
        for name in ('Wildgrid.exe', 'Wildgrid.apk'):
            (DIRECTORY / f'.{name}.{token}.upload').unlink(missing_ok=True)
    else:
        raise RuntimeError('Unknown deployment action')


if __name__ == '__main__':
    main()
