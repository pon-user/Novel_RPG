#!/usr/bin/env python3
"""Free, standard-library-only local preview server."""
import argparse
import functools
import http.server
import pathlib
import webbrowser


def main():
    parser = argparse.ArgumentParser(description='丘の向こうの道：無料ローカル試遊サーバー')
    parser.add_argument('--host', default='127.0.0.1')
    parser.add_argument('--port', type=int, default=8765)
    parser.add_argument('--no-open', action='store_true')
    args = parser.parse_args()
    directory = pathlib.Path(__file__).resolve().parent / 'docs'
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(directory))
    try:
        server = http.server.ThreadingHTTPServer((args.host, args.port), handler)
    except OSError as error:
        parser.exit(1, f'起動できませんでした: {error}\n別の確認用サーバーが動いていないか確認してください。\n')
    url = f'http://127.0.0.1:{args.port}/'
    print(f'丘の向こうの道\nブラウザで開く: {url}\n終了: Ctrl+C\n', flush=True)
    if not args.no_open:
        webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
