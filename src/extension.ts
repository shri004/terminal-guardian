import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Each entry describes one dangerous command
interface DangerousCommand {
  pattern: RegExp;
  name: string;
  what: string;
  recovery: string;
  safer: string;
}

// The command list — this is the heart of the extension
const DANGEROUS_COMMANDS: DangerousCommand[] = [
  {
    pattern: /git\s+clean\s+-\S*f/i,
    name: 'git clean -f',
    what: 'Permanently deletes all untracked files. These were never in git history — they are gone forever.',
    recovery: 'Run "git reflog" to check recent history. Untracked files cannot be recovered through git.',
    safer: 'Run "git clean -n" first — it previews what would be deleted without deleting anything.'
  },
  {
    pattern: /git\s+reset\s+--hard/i,
    name: 'git reset --hard',
    what: 'Throws away all uncommitted changes to tracked files. Any edits not yet committed are gone.',
    recovery: 'Run "git reflog" to find the commit before the reset, then "git reset --hard <that-hash>".',
    safer: 'Run "git stash" first to save your changes safely, then reset.'
  },
  {
    pattern: /git\s+checkout\s+\./i,
    name: 'git checkout .',
    what: 'Discards all uncommitted changes to tracked files, reverting them to the last commit.',
    recovery: 'Uncommitted changes cannot be recovered through git. Check your editor local history.',
    safer: 'Use "git stash" to save changes safely before checking out.'
  },
  {
    pattern: /git\s+push\s+.*--force(?!-with-lease)/i,
    name: 'git push --force',
    what: 'Overwrites the remote branch with your local version. Teammates on the same branch will have conflicts.',
    recovery: 'Ask teammates if they have local copies. Check if the remote has reflog enabled.',
    safer: 'Use "git push --force-with-lease" — only pushes if nobody else pushed since your last pull.'
  },
  {
    pattern: /rm\s+-rf/i,
    name: 'rm -rf',
    what: 'Permanently deletes files and folders with no confirmation. Does not go to Recycle Bin or Trash.',
    recovery: 'Files deleted with rm -rf are not recoverable on SSDs.',
    safer: 'Double-check the exact path before running. Consider moving to trash manually first.'
  },
  {
    pattern: /docker\s+system\s+prune/i,
    name: 'docker system prune',
    what: 'Removes all stopped containers, unused networks, dangling images, and build cache.',
    recovery: 'Images can be re-pulled from registry. Local container data is gone.',
    safer: 'Use "docker system prune --filter until=24h" to only remove things older than 24 hours.'
  },
  {
    pattern: /DROP\s+(DATABASE|TABLE|SCHEMA)/i,
    name: 'DROP DATABASE / TABLE / SCHEMA',
    what: 'Permanently deletes the database, table, or schema and every row of data inside it.',
    recovery: 'Only recoverable from a backup. No backup means the data is gone permanently.',
    safer: 'Always take a backup before DROP commands. Use a transaction if your database supports rollback.'
  },
  {
    pattern: /git\s+branch\s+-D/i,
    name: 'git branch -D',
    what: 'Force deletes a branch permanently, even if it has unmerged changes.',
    recovery: 'Run "git reflog" — the commits still exist for a while. Find the hash and recreate the branch.',
    safer: 'Use "git branch -d" (lowercase d) — only deletes if the branch is fully merged.'
  },
  {
    pattern: /git\s+stash\s+(drop|clear)/i,
    name: 'git stash drop / clear',
    what: 'Permanently deletes stashed changes. Cannot be recovered through normal git commands.',
    recovery: 'Run "git fsck --lost-found" — may recover dangling stash commits.',
    safer: 'Run "git stash list" first to confirm exactly what you are about to delete.'
  },
  {
    pattern: /terraform\s+destroy/i,
    name: 'terraform destroy',
    what: 'Destroys ALL infrastructure resources managed by this Terraform state.',
    recovery: 'Re-run terraform apply but data stored in destroyed resources is permanently gone.',
    safer: 'Run "terraform plan -destroy" first to see exactly what will be removed.'
  },
  {
    pattern: /kubectl\s+delete\s+(namespace|ns|all)/i,
    name: 'kubectl delete namespace / all',
    what: 'Deletes Kubernetes namespaces or all resources. Services go down immediately.',
    recovery: 'Redeploy from manifests. Persistent volume data may be gone.',
    safer: 'Run "kubectl get all -n <namespace>" first to see what will be deleted.'
  },
  {
    pattern: /TRUNCATE\s+TABLE/i,
    name: 'TRUNCATE TABLE',
    what: 'Deletes every row in the table instantly. Faster and less recoverable than DELETE.',
    recovery: 'Only recoverable from a backup. TRUNCATE cannot be rolled back in many databases.',
    safer: 'Use "DELETE FROM table WHERE ..." to remove specific rows with conditions.'
  },
  {
    pattern: /aws\s+s3\s+rm.*--recursive/i,
    name: 'aws s3 rm --recursive',
    what: 'Permanently deletes all files in an S3 bucket or prefix. No trash, no undo.',
    recovery: 'Only recoverable if S3 versioning was enabled on the bucket before deletion.',
    safer: 'Run "aws s3 ls <path>" first to confirm exactly what is there.'
  }
];

export function activate(context: vscode.ExtensionContext) {

  // --- Auto-install on first activation ---
  const alreadyInstalled = context.globalState.get('guardianInstalled', false);

  if (!alreadyInstalled) {
    vscode.window.showInformationMessage(
      'Terminal Guardian: Set up automatic terminal protection?',
      'Yes, set it up',
      'Later'
    ).then(selection => {
      if (selection === 'Yes, set it up') {
        installGuardian(context);
      }
    });
  }

  // --- Manual reinstall command ---
  const reinstallCmd = vscode.commands.registerCommand(
    'terminal-guardian.install',
    () => installGuardian(context)
  );

  // --- Observation layer (fallback warnings via VS Code notifications) ---
  const listener = vscode.window.onDidStartTerminalShellExecution(event => {
    const command = event.execution.commandLine.value.trim();
    for (const dangerous of DANGEROUS_COMMANDS) {
      if (dangerous.pattern.test(command)) {
        showWarning(dangerous);
        break;
      }
    }
  });

  context.subscriptions.push(reinstallCmd, listener);
}

function installGuardian(context: vscode.ExtensionContext) {
  try {
    const scriptPath = path.join(context.extensionPath, 'src', 'guardian.ps1');

    if (!fs.existsSync(scriptPath)) {
      vscode.window.showErrorMessage(
        'Terminal Guardian: Could not find guardian.ps1. Try reinstalling the extension.'
      );
      return;
    }

    // Profile lives in OneDrive/Documents on most Windows machines
    const profilePath = path.join(
      os.homedir(),
      'OneDrive', 'Documents', 'WindowsPowerShell',
      'Microsoft.PowerShell_profile.ps1'
    );

    const profileDir = path.dirname(profilePath);
    if (!fs.existsSync(profileDir)) {
      fs.mkdirSync(profileDir, { recursive: true });
    }

    let profileContent = '';
    if (fs.existsSync(profilePath)) {
      profileContent = fs.readFileSync(profilePath, 'utf8');
    }

    if (profileContent.includes('terminal-guardian')) {
      vscode.window.showInformationMessage(
        'Terminal Guardian: Already installed in your PowerShell profile.'
      );
      return;
    }

    const profileLine = `\n# Terminal Guardian\n. "${scriptPath}"\n`;
    fs.appendFileSync(profilePath, profileLine, 'utf8');

    context.globalState.update('guardianInstalled', true);

    vscode.window.showInformationMessage(
      'Terminal Guardian installed! Restart your terminal to activate.',
      'Restart Terminal'
    ).then(selection => {
      if (selection === 'Restart Terminal') {
        vscode.commands.executeCommand('workbench.action.terminal.kill');
        vscode.commands.executeCommand('workbench.action.terminal.new');
      }
    });

  } catch (err) {
    vscode.window.showErrorMessage(
      `Terminal Guardian: Installation failed — ${err}`
    );
  }
}

function showWarning(cmd: DangerousCommand) {
  vscode.window.showWarningMessage(
    `[!] ${cmd.name}: ${cmd.what}`,
    'How to recover',
    'Safer alternative'
  ).then(selection => {
    if (selection === 'How to recover') {
      vscode.window.showInformationMessage(`Recovery: ${cmd.recovery}`);
    } else if (selection === 'Safer alternative') {
      vscode.window.showInformationMessage(`Safer: ${cmd.safer}`);
    }
  });
}

export function deactivate() {}