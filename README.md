# Terminal Guardian

Every developer has a story. A wrong command in a rushed moment, a misread flag, a terminal that didn't ask twice. The project was gone before the mistake registered.
Modern development moves fast. Commands get longer, workflows get more complex, and the terminal remains completely silent about what it's about to do to your work.
Terminal Guardian adds a voice to that silence.

---

## What it does

When you run a potentially destructive terminal command, Terminal Guardian intercepts it **before execution** and shows you:

- Exactly what the command will do in plain English
- How to recover if you have already run it by mistake
- A safer alternative that achieves the same goal with less risk

You then choose — run it anyway, or cancel. The command does not execute until you decide.

---

## Commands it protects against

• git reset --hard
Risk: Permanently discards all uncommitted changes.

• git clean -f
Risk: Deletes all untracked files with no recovery path.

• git push --force
Risk: Overwrites remote branch and can break teammates' work.

• git checkout .
Risk: Silently discards all working directory changes.

• git branch -D
Risk: Force deletes a branch even if work is unmerged.

• git stash drop / git stash clear
Risk: Permanently removes stashed changes.

• git filter-branch
Risk: Rewrites commit history permanently.

• rm -rf
Risk: Deletes files and folders with no Recycle Bin recovery.

• rd /s / del /f
Risk: Force deletes files and folders on Windows.

• docker system prune
Risk: Removes containers, images, networks, and build cache.

• terraform destroy
Risk: Deletes all infrastructure managed by Terraform.

• kubectl delete namespace
Risk: Deletes a Kubernetes namespace and all resources inside it.

• DROP DATABASE / DROP TABLE
Risk: Permanently deletes a database or table and all its data.

• TRUNCATE TABLE
Risk: Instantly removes all rows from a table.

• aws s3 rm --recursive
Risk: Permanently deletes all objects in an S3 bucket or path.

---

## Setup

**1. Install the extension** from the VS Code Marketplace.

**2. A prompt will appear** asking to set up terminal protection.
Click **Yes, set it up**.

**3. Restart your terminal** when prompted. You will see:
Terminal Guardian active [OK]

That is it. No manual paths, no configuration needed.

If you missed the prompt, open the Command Palette
(`Ctrl+Shift+P`) and run:
Terminal Guardian: Set up terminal protection

---

## How it works

Terminal Guardian hooks into PowerShell's PSReadLine layer — the same layer that handles your terminal input. When you press Enter, the hook reads the command before the shell receives it. If the command matches a known destructive pattern, execution is paused and the warning is shown. If you type `run` and press Enter, the command proceeds. If you press Enter alone, it is cancelled.
Non-dangerous commands pass through instantly with zero delay.

---

## Contributing

Found a command that should be on the list? Open an issue or pull request on GitHub. The command list lives in `src/guardian.ps1`and is straightforward to extend.
