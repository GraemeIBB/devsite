docker build -t devlog -f dockerfile . && docker run --rm -p 5000:5000 -p 5173:5173 --env-file backend/.env devlog
