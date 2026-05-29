# Terminal Guardian - PSReadLine hook
# Intercepts dangerous commands before they execute

$TG_COMMANDS = @(
    @{
        Pattern  = 'git\s+reset\s+--hard'
        Name     = 'git reset --hard'
        Risk     = 'Throws away ALL uncommitted changes permanently. Cannot be undone.'
        Recovery = 'Run: git reflog - find the commit hash before the reset, then git reset --hard <hash>'
        Safer    = 'Run: git stash - saves your changes safely before resetting'
    },
    @{
        Pattern  = 'git\s+clean\s+-\S*f'
        Name     = 'git clean -f'
        Risk     = 'Permanently deletes all untracked files. They were never in git history.'
        Recovery = 'Untracked files cannot be recovered through git. Check if you have backups.'
        Safer    = 'Run: git clean -n first - previews what would be deleted without deleting'
    },
    @{
        Pattern  = 'git\s+push\s+.*--force(?!-with-lease)'
        Name     = 'git push --force'
        Risk     = 'Overwrites the remote branch. Teammates on the same branch will have conflicts.'
        Recovery = 'Ask teammates if they have local copies of the overwritten commits.'
        Safer    = 'Use: git push --force-with-lease instead - safer version of force push'
    },
    @{
        Pattern  = 'git\s+checkout\s+\.'
        Name     = 'git checkout .'
        Risk     = 'Discards all uncommitted changes to tracked files immediately.'
        Recovery = 'Uncommitted changes cannot be recovered through git.'
        Safer    = 'Use: git stash - saves changes before checking out'
    },
    @{
        Pattern  = 'rm\s+-rf'
        Name     = 'rm -rf'
        Risk     = 'Permanently deletes files and folders. Does not go to Recycle Bin.'
        Recovery = 'Not recoverable on SSDs. Check if a backup exists.'
        Safer    = 'Double-check the exact path before running.'
    },
    @{
        Pattern  = 'docker\s+system\s+prune'
        Name     = 'docker system prune'
        Risk     = 'Removes all stopped containers, unused networks, images, and build cache.'
        Recovery = 'Images can be re-pulled. Local container data is gone.'
        Safer    = 'Use: docker system prune --filter until=24h'
    },
    @{
        Pattern  = 'DROP\s+(DATABASE|TABLE|SCHEMA)'
        Name     = 'DROP DATABASE / TABLE / SCHEMA'
        Risk     = 'Permanently deletes the database or table and ALL data inside it.'
        Recovery = 'Only recoverable from a backup. No backup means data is gone.'
        Safer    = 'Always take a backup before DROP commands.'
    },
    @{
        Pattern  = 'git\s+branch\s+-D'
        Name     = 'git branch -D'
        Risk     = 'Force deletes a branch permanently, even if it has unmerged changes.'
        Recovery = 'Run: git reflog - the commits still exist for a while, find the hash and recreate the branch.'
        Safer    = 'Use: git branch -d (lowercase) - only deletes if fully merged.'
    },
    @{
        Pattern  = 'git\s+stash\s+drop|git\s+stash\s+clear'
        Name     = 'git stash drop / clear'
        Risk     = 'Permanently deletes stashed changes. Cannot be recovered through git.'
        Recovery = 'Run: git fsck --lost-found - may recover dangling stash commits.'
        Safer    = 'Run: git stash list first to confirm what you are deleting.'
    },
    @{
        Pattern  = 'npx\s+rimraf|rimraf'
        Name     = 'rimraf'
        Risk     = 'Recursively and permanently deletes files and folders like rm -rf on Unix.'
        Recovery = 'Not recoverable. Check if files were committed or backed up.'
        Safer    = 'Double check the target path before running.'
    },
    @{
        Pattern  = 'rd\s+/s|rmdir\s+/s'
        Name     = 'rd /s or rmdir /s'
        Risk     = 'Permanently deletes a folder and everything inside it on Windows.'
        Recovery = 'Not recoverable on SSDs. Check Recycle Bin or backups.'
        Safer    = 'Move the folder to Recycle Bin manually first to verify contents.'
    },
    @{
        Pattern  = 'del\s+/f'
        Name     = 'del /f'
        Risk     = 'Force deletes files on Windows bypassing read-only protection.'
        Recovery = 'Check Recycle Bin. If bypassed with /s it may not be there.'
        Safer    = 'Remove the /f flag and let Windows prompt you for confirmation.'
    },
    @{
        Pattern  = 'terraform\s+destroy'
        Name     = 'terraform destroy'
        Risk     = 'Destroys ALL infrastructure resources managed by this Terraform state.'
        Recovery = 'Re-run terraform apply but data stored in destroyed resources is gone.'
        Safer    = 'Run: terraform plan -destroy first to see exactly what will be removed.'
    },
    @{
        Pattern  = 'kubectl\s+delete\s+(namespace|ns|all)'
        Name     = 'kubectl delete namespace/all'
        Risk     = 'Deletes Kubernetes namespaces or all resources. Services go down immediately.'
        Recovery = 'Redeploy from manifests. Persistent volume data may be gone.'
        Safer    = 'Run: kubectl get all -n <namespace> first to see what will be deleted.'
    },
    @{
        Pattern  = 'TRUNCATE\s+TABLE'
        Name     = 'TRUNCATE TABLE'
        Risk     = 'Deletes every row in the table instantly. Much faster and less recoverable than DELETE.'
        Recovery = 'Only recoverable from a backup. Unlike DELETE, TRUNCATE cannot be rolled back in many databases.'
        Safer    = 'Use: DELETE FROM table WHERE ... to remove specific rows instead.'
    },
    @{
        Pattern  = 'git\s+filter-branch|git\s+filter-repo'
        Name     = 'git filter-branch / filter-repo'
        Risk     = 'Rewrites git history permanently. Affects every commit. Teammates will have broken repos.'
        Recovery = 'Coordinate with entire team. Everyone needs to re-clone after this runs.'
        Safer    = 'Make a backup branch first: git branch backup-before-filter'
    },
    @{
        Pattern  = 'aws\s+s3\s+rm.*--recursive'
        Name     = 'aws s3 rm --recursive'
        Risk     = 'Permanently deletes all files in an S3 bucket or prefix. No trash or undo.'
        Recovery = 'Only recoverable if S3 versioning was enabled on the bucket.'
        Safer    = 'Run: aws s3 ls <path> first to confirm what is there.'
    }
)

function Get-TGMatch($line) {
    foreach ($cmd in $TG_COMMANDS) {
        if ($line -match $cmd.Pattern) {
            return $cmd
        }
    }
    return $null
}

# This overrides the Enter key in your terminal
Set-PSReadLineKeyHandler -Key Enter -ScriptBlock {
    $line = $null
    $cursor = $null
    [Microsoft.PowerShell.PSConsoleReadLine]::GetBufferState([ref]$line, [ref]$cursor)

    $match = Get-TGMatch $line

    if ($match -and $line.Trim() -ne '') {
        # Clear the current line first
        [Microsoft.PowerShell.PSConsoleReadLine]::RevertLine()

        Write-Host ""
        Write-Host "  [!]  TERMINAL GUARDIAN" -ForegroundColor Yellow
        Write-Host "  ---------------------------------------" -ForegroundColor DarkGray
        Write-Host "  Command  : $line" -ForegroundColor White
        Write-Host "  Risk     : $($match.Risk)" -ForegroundColor Red
        Write-Host "  Recovery : $($match.Recovery)" -ForegroundColor Cyan
        Write-Host "  Safer    : $($match.Safer)" -ForegroundColor Green
        Write-Host "  ---------------------------------------" -ForegroundColor DarkGray
        Write-Host ""

        $response = Read-Host "  Type 'run' to execute anyway, or press Enter to cancel"

        if ($response.Trim().ToLower() -eq 'run') {
            Write-Host "  Running command..." -ForegroundColor DarkYellow
            Write-Host ""
            [Microsoft.PowerShell.PSConsoleReadLine]::Insert($line)
            [Microsoft.PowerShell.PSConsoleReadLine]::AcceptLine()
        }
        else {
            Write-Host " Command was not executed [Cancelled]" -ForegroundColor Green
            Write-Host ""
        }
    }
    else {
        # Not dangerous - execute normally
        [Microsoft.PowerShell.PSConsoleReadLine]::AcceptLine()
    }
}

Write-Host "  Terminal Guardian active [OK]" -ForegroundColor DarkGreen