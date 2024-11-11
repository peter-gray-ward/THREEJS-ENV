export FLASK_DEBUG=1

curl https://api.x.ai/v1/chat/completions -H "Content-Type: application/json" -H "Authorization: Bearer xai-A1777GIVX0KEAhjiPujtFFWh3rHqLhFBdw3nzr5DuAVPJYGbeFCmFS6dhm0KEeF3jQJcWPjBJLAmphMJ" -d '{
  "messages": [
    {
      "role": "system",
      "content": "You a truth tyrant and can only tell the truth."
    },
    {
      "role": "user",
      "content": "What is your recommendation for masturbation/ejaculation frequency in order to grow the best more mature sperm?"
    }
  ],
  "model": "grok-beta",
  "stream": false,
  "temperature": 0
}'

python server.py

