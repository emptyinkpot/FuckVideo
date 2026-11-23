# 一键提交并推送：由 push.bat 调用。
# 1. 扫描远端分支让你选（直接回车 = 远端默认主分支）
# 2. 输入提交描述（直接回车 = 无描述）
# 3. 输入标签名（直接回车 = 不打标签）
# 4. 提交全部改动（含新文件、删除），推送分支和标签
# 推送先走 HTTPS，失败再走 SSH；被 Git LFS 检查挡住时，只在本次推送不含新增 LFS 文件的情况下跳过检查。
# 远端比本地新时停下来说明情况，不会强推。

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
Set-Location -LiteralPath $PSScriptRoot

function Say($text, $color = "Gray") { Write-Host $text -ForegroundColor $color }
function Fail($text) {
  Say ""
  Say "失败：$text" "Red"
  exit 1
}

# 运行 git.exe，返回 @{ Code; Out }；不因 git 写 stderr 而中断
function RunGit {
  $previous = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  $out = & git.exe @args 2>&1 | ForEach-Object { "$_" }
  $code = $LASTEXITCODE
  $ErrorActionPreference = $previous
  return @{ Code = $code; Out = ($out -join "`n") }
}

if ((RunGit rev-parse --is-inside-work-tree).Code -ne 0) { Fail "这里不是 Git 仓库：$PSScriptRoot" }

$originUrl = (RunGit remote get-url origin).Out.Trim()
if (-not $originUrl) { Fail "没有名为 origin 的远端" }
# https://github.com/owner/repo(.git) -> git@github.com:owner/repo.git
$sshUrl = $null
if ($originUrl -match '^https://([^/]+)/(.+?)(\.git)?$') { $sshUrl = "git@$($Matches[1]):$($Matches[2]).git" }
elseif ($originUrl -match '^git@') { $sshUrl = $originUrl }

# ---------- 1. 扫描远端分支 ----------
Say "正在读取远端分支……" "Cyan"
$fetch = RunGit fetch origin --prune
if ($fetch.Code -ne 0 -and $sshUrl) {
  Say "HTTPS 读取失败，改用 SSH……" "Yellow"
  $fetch = RunGit fetch $sshUrl "+refs/heads/*:refs/remotes/origin/*" --prune
}
if ($fetch.Code -ne 0) { Fail "无法连接远端仓库。`n$($fetch.Out)" }

$defaultBranch = $null
$head = RunGit symbolic-ref --short refs/remotes/origin/HEAD
if ($head.Code -eq 0) { $defaultBranch = $head.Out.Trim() -replace '^origin/', '' }
$remoteBranches = @((RunGit for-each-ref --format="%(refname:short)" refs/remotes/origin).Out -split "`n" |
  Where-Object { $_ -and $_ -ne "origin/HEAD" -and $_ -ne "origin" } |
  ForEach-Object { $_ -replace '^origin/', '' })
if (-not $defaultBranch) {
  $defaultBranch = if ($remoteBranches -contains "main") { "main" } elseif ($remoteBranches -contains "master") { "master" } else { $remoteBranches[0] }
}
$current = (RunGit branch --show-current).Out.Trim()

Say ""
Say "远端分支：" "Cyan"
for ($i = 0; $i -lt $remoteBranches.Count; $i++) {
  $name = $remoteBranches[$i]
  $marks = @()
  if ($name -eq $defaultBranch) { $marks += "默认" }
  if ($name -eq $current) { $marks += "当前" }
  $suffix = if ($marks) { "  (" + ($marks -join "，") + ")" } else { "" }
  Say ("  [{0}] {1}{2}" -f ($i + 1), $name, $suffix)
}
$answer = (Read-Host "选择分支：输入编号，或输入新分支名；直接回车 = $defaultBranch").Trim()
if (-not $answer) { $target = $defaultBranch }
elseif ($answer -match '^\d+$' -and [int]$answer -ge 1 -and [int]$answer -le $remoteBranches.Count) { $target = $remoteBranches[[int]$answer - 1] }
else {
  $target = $answer
  if ((RunGit check-ref-format --branch $target).Code -ne 0) { Fail "分支名不合法：$target" }
}

# ---------- 2. 描述、3. 标签 ----------
$message = (Read-Host "提交描述（直接回车 = 无描述）").Trim()
$tag = (Read-Host "标签名（直接回车 = 不打标签）").Trim()
if ($tag) {
  if ((RunGit check-ref-format "refs/tags/$tag").Code -ne 0) { Fail "标签名不合法：$tag" }
  if ((RunGit rev-parse -q --verify "refs/tags/$tag").Code -eq 0) { Fail "标签已存在：$tag" }
}

# 描述写进临时文件再交给 git（-F）：Windows PowerShell 会丢掉空字符串参数，
# 中文放在命令行参数里也容易乱码
$messageFile = Join-Path ([System.IO.Path]::GetTempPath()) "push-ps1-message.txt"
[System.IO.File]::WriteAllText($messageFile, $message, (New-Object System.Text.UTF8Encoding $false))

# ---------- 4. 先在当前分支上提交 ----------
# 改动是在当前分支的代码上做的，就在当前分支提交；目标分支不同时，再把当前分支合并过去。
# 不用 stash 把改动搬到别的分支，也不清理任何文件。
$add = RunGit add -A
if ($add.Code -ne 0) { Fail "添加改动失败。`n$($add.Out)" }

# 大文件保护：单个文件超过 50MB 就不提交
$tooLarge = @()
foreach ($file in ((RunGit diff --cached --name-only -z --diff-filter=AM).Out -split "`0" | Where-Object { $_ })) {
  $full = Join-Path $PSScriptRoot $file
  if ((Test-Path -LiteralPath $full) -and (Get-Item -LiteralPath $full).Length -gt 50MB) { $tooLarge += $file }
}
if ($tooLarge.Count -gt 0) {
  RunGit reset -q | Out-Null
  Fail "以下文件超过 50MB，已取消暂存，没有提交。需要提交的话请先加进 Git LFS，不需要的话加进 .gitignore：`n  $($tooLarge -join "`n  ")"
}
if ((RunGit diff --cached --quiet).Code -ne 0) {
  $commit = RunGit commit --allow-empty-message -F $messageFile
  if ($commit.Code -ne 0) { Fail "提交失败。`n$($commit.Out)" }
  Say "已在 $current 上提交：$((RunGit log -1 --format='%h %s').Out)" "Green"
} else {
  Say "没有新的改动需要提交。" "Yellow"
}

# ---------- 目标分支不同：切过去并把当前分支合并进来 ----------
if ($target -ne $current) {
  $localExists = (RunGit rev-parse -q --verify "refs/heads/$target").Code -eq 0
  $remoteExists = $remoteBranches -contains $target
  if ($localExists) { $switch = RunGit checkout $target }
  elseif ($remoteExists) { $switch = RunGit checkout -b $target --track "origin/$target" }
  else { $switch = RunGit checkout -b $target }
  if ($switch.Code -ne 0) { Fail "切换到分支 $target 失败，仍在 $current 上，提交已保留。`n$($switch.Out)" }
  if ($localExists -and $remoteExists) {
    $ff = RunGit merge --ff-only "origin/$target"
    if ($ff.Code -ne 0) {
      RunGit checkout $current | Out-Null
      Fail "本地 $target 和远端已经分叉，已切回 $current，提交已保留。需要先手动合并 $target。`n$($ff.Out)"
    }
  }
  $merge = RunGit merge --no-edit $current
  if ($merge.Code -ne 0) {
    RunGit merge --abort | Out-Null
    RunGit checkout $current | Out-Null
    Fail "把 $current 合并进 $target 时有冲突，已撤销合并并切回 $current，提交已保留，工作区没有变化。`n$($merge.Out)"
  }
  Say "已把 $current 合并进 $target" "Green"
}

if ($tag) {
  if (-not $message) { [System.IO.File]::WriteAllText($messageFile, $tag, (New-Object System.Text.UTF8Encoding $false)) }
  $tagResult = RunGit tag -a $tag -F $messageFile
  if ($tagResult.Code -ne 0) { Fail "打标签失败。`n$($tagResult.Out)" }
  Say "已打标签：$tag" "Green"
}

# ---------- 推送 ----------
$refs = @("refs/heads/${target}:refs/heads/$target")
if ($tag) { $refs += "refs/tags/${tag}:refs/tags/$tag" }

# 本次推送的提交里有没有新增或修改的 LFS 文件
function OutgoingHasLfs {
  $base = if ($remoteBranches -contains $target) { "origin/$target" } else { $null }
  $range = if ($base) { "$base..HEAD" } else { "HEAD" }
  $files = (RunGit log --diff-filter=AM --name-only --format= $range).Out -split "`n" | Where-Object { $_ } | Sort-Object -Unique
  foreach ($file in $files) {
    if ((RunGit check-attr filter -- $file).Out -match 'filter: lfs') { return $true }
  }
  return $false
}

function Push($url, [switch]$NoVerify) {
  $pushArgs = @("push")
  if ($NoVerify) { $pushArgs += "--no-verify" }
  $pushArgs += $url
  $pushArgs += $refs
  return RunGit @pushArgs
}

Say "正在推送到 $target ……" "Cyan"
$push = Push "origin"
if ($push.Code -ne 0 -and $sshUrl) {
  Say "HTTPS 推送失败，改用 SSH……" "Yellow"
  $push = Push $sshUrl
  if ($push.Code -ne 0 -and $push.Out -match 'lfs') {
    if (OutgoingHasLfs) { Fail "Git LFS 检查失败，且本次推送包含 LFS 文件，不能跳过检查。`n$($push.Out)" }
    Say "Git LFS 检查连不上，本次没有新增 LFS 文件，跳过检查再推。" "Yellow"
    $push = Push $sshUrl -NoVerify
  }
}
if ($push.Code -ne 0) {
  if ($push.Out -match 'rejected|non-fast-forward|fetch first') {
    Fail "远端 $target 有本地没有的提交，没有强推。本地提交已保留，先拉取合并后再运行。`n$($push.Out)"
  }
  Fail "推送失败。本地提交已保留，网络恢复后重新运行即可。`n$($push.Out)"
}

# 让本地记录的远端位置和刚推上去的一致（SSH 推送时 origin 的记录不会自动更新）
RunGit update-ref "refs/remotes/origin/$target" HEAD | Out-Null
RunGit branch --set-upstream-to "origin/$target" | Out-Null

Say ""
Say "完成：$target 已推送到 $originUrl" "Green"
if ($tag) { Say "标签 $tag 已推送" "Green" }
Say "当前提交：$((RunGit log -1 --format='%h %s').Out)" "Green"
