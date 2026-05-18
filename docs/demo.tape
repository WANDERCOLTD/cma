# vhs tape — record a demo gif of /cma:merge end-to-end.
#
# Install: brew install vhs
# Record:  vhs docs/demo.tape  → emits docs/demo.gif
#
# Requires: a small throwaway repo already initialised with .merge-agent.json,
# a green test command, and a "feat/demo" branch with one commit ahead of main.
# Set DEMO_REPO to that path before running.

Output docs/demo.gif

Set FontSize 16
Set Width 1100
Set Height 660
Set Theme "Catppuccin Mocha"
Set Padding 24
Set Margin 12
Set BorderRadius 14

Type "cd $DEMO_REPO" Enter
Sleep 500ms

# Show status before merging
Type "/cma:status" Enter
Sleep 2s

# Then the actual merge
Type "/cma:merge" Enter
Sleep 6s

# Pop the dashboard
Type "/cma:dashboard" Enter
Sleep 1500ms
