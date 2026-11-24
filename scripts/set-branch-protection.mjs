// 收紧 master 分支保护：要求 PR、两项 CI 通过、禁止管理员绕过与强推。
// 需要 fine-grained token，权限：Administration (write)。
const repo = process.env.GITHUB_REPOSITORY || 'TomSouya/retailos'
const branch = process.env.GITHUB_BRANCH || 'master'
const approvals = Number(process.env.REQUIRED_APPROVALS || 0)
const dryRun = process.argv.includes('--dry-run')

const payload = {
  required_status_checks: {
    strict: true,
    contexts: ['build-and-smoke', 'e2e'],
  },
  enforce_admins: true,
  required_pull_request_reviews: {
    dismiss_stale_reviews: true,
    require_code_owner_reviews: false,
    required_approving_review_count: approvals,
  },
  restrictions: null,
  required_linear_history: true,
  allow_force_pushes: false,
  allow_deletions: false,
  required_conversation_resolution: true,
}

if (dryRun) {
  console.log(JSON.stringify(payload, null, 2))
  process.exit(0)
}

const token = String(process.env.GITHUB_TOKEN || '').trim()
if (!token) {
  console.error(
    '需要 GITHUB_TOKEN（fine-grained，Administration: write）；可先加 --dry-run 查看配置',
  )
  process.exit(1)
}

const response = await fetch(
  `https://api.github.com/repos/${repo}/branches/${branch}/protection`,
  {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'RetailOS-Branch-Protection',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  },
)

if (!response.ok) {
  console.error(`BRANCH_PROTECTION_FAILED ${response.status}`)
  console.error(await response.text())
  process.exit(1)
}

console.log(`BRANCH_PROTECTION OK ${repo}@${branch}`)
