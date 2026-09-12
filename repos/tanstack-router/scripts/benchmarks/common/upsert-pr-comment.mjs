#!/usr/bin/env node

import { promises as fsp } from 'node:fs'
import path from 'node:path'
import { parseArgs as parseNodeArgs } from 'node:util'

const DEFAULT_MARKER = '<!-- bundle-size-benchmark -->'

function parseArgs(argv) {
  const { values } = parseNodeArgs({
    args: argv,
    allowPositionals: false,
    strict: true,
    options: {
      pr: { type: 'string' },
      'body-file': { type: 'string' },
      repo: { type: 'string' },
      token: { type: 'string' },
      marker: { type: 'string' },
      'api-url': { type: 'string' },
    },
  })

  const args = {
    pr: values.pr ? Number.parseInt(values.pr, 10) : undefined,
    bodyFile: values['body-file'],
    repo: values.repo ?? process.env.GITHUB_REPOSITORY,
    marker: values.marker ?? DEFAULT_MARKER,
    token: values.token ?? (process.env.GITHUB_TOKEN || process.env.GH_TOKEN),
    apiUrl:
      values['api-url'] ??
      (process.env.GITHUB_API_URL || 'https://api.github.com'),
  }

  if (!Number.isFinite(args.pr) || args.pr <= 0) {
    throw new Error('Missing required argument: --pr')
  }

  if (!args.bodyFile) {
    throw new Error('Missing required argument: --body-file')
  }

  if (!args.repo || !args.repo.includes('/')) {
    throw new Error(
      'Missing repository context. Provide --repo or GITHUB_REPOSITORY.',
    )
  }

  if (!args.token) {
    throw new Error('Missing token. Provide --token or GITHUB_TOKEN.')
  }

  return args
}

async function githubRequest({ apiUrl, token, method, endpoint, body }) {
  const url = `${apiUrl.replace(/\/$/, '')}${endpoint}`
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'tanstack-router-bundle-size-bot',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(
      `${method} ${endpoint} failed (${response.status} ${response.statusText}): ${text}`,
    )
  }

  if (response.status === 204) {
    return undefined
  }

  return response.json()
}

async function listIssueComments({ apiUrl, token, repo, pr }) {
  const comments = []
  let page = 1
  const perPage = 100

  for (;;) {
    const data = await githubRequest({
      apiUrl,
      token,
      method: 'GET',
      endpoint: `/repos/${repo}/issues/${pr}/comments?per_page=${perPage}&page=${page}`,
    })

    comments.push(...data)

    if (!Array.isArray(data) || data.length < perPage) {
      break
    }

    page += 1
  }

  return comments
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const bodyPath = path.resolve(args.bodyFile)
  const rawBody = await fsp.readFile(bodyPath, 'utf8')
  const body = rawBody.includes(args.marker)
    ? rawBody
    : `${args.marker}\n${rawBody}`

  const comments = await listIssueComments({
    apiUrl: args.apiUrl,
    token: args.token,
    repo: args.repo,
    pr: args.pr,
  })

  const existing = comments.find(
    (comment) =>
      typeof comment?.body === 'string' && comment.body.includes(args.marker),
  )

  if (existing) {
    await githubRequest({
      apiUrl: args.apiUrl,
      token: args.token,
      method: 'PATCH',
      endpoint: `/repos/${args.repo}/issues/comments/${existing.id}`,
      body: { body },
    })

    process.stdout.write(
      `Updated PR #${args.pr} bundle-size comment (${existing.id}).\n`,
    )
    return
  }

  const created = await githubRequest({
    apiUrl: args.apiUrl,
    token: args.token,
    method: 'POST',
    endpoint: `/repos/${args.repo}/issues/${args.pr}/comments`,
    body: { body },
  })

  process.stdout.write(
    `Created PR #${args.pr} bundle-size comment (${created?.id ?? 'unknown'}).\n`,
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
