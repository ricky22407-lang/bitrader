
#!/bin/bash
DIR="$(cd "$(dirname "$0")" && pwd)"
osascript -e 'tell application "Terminal"
    do script "cd '"$DIR"' && bash autopilot.command"
    do script "cd '"$DIR"' && bash monitor.command"
    do script "cd '"$DIR"' && bash manager.command"
    do script "cd '"$DIR"' && bash gpt_agent.command"
end tell'
echo "Launched Autopilot + Monitor + Manager + GPT Agent in separate Terminal windows."
