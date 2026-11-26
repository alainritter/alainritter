import { WEEKS } from "./sanitize.mjs";

const QUERY = `query($since: GitTimestamp!, $after: String, $author: ID!) {
  viewer { repositories(first: 50, after: $after, ownerAffiliations: OWNER, isFork: false) {
    pageInfo { hasNextPage endCursor }
    nodes { name url isPrivate isArchived diskUsage stargazerCount createdAt pushedAt
      primaryLanguage { name color }
      defaultBranchRef { target { ... on Commit { history(first: 100, since: $since, author: {id: $author}) { nodes { committedDate } } } } }
    } } }
}`;

async function gql(token, variables) {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: QUERY, variables }),
  });
  const json = await res.json();
  if (!res.ok || json.errors) {
    throw new Error(`GraphQL failed: ${res.status} ${JSON.stringify(json.errors ?? "").slice(0, 200)}`);
  }
  return json.data.viewer.repositories;
}

export async function fetchRepos(token) {
  const idRes = await fetch("https://api.github.com/user", { headers: { Authorization: `Bearer ${token}` } });
  if (!idRes.ok) throw new Error(`user lookup failed: ${idRes.status}`);
  const author = (await idRes.json()).node_id;
  const since = new Date(Date.now() - WEEKS * 7 * 86400000).toISOString();
  const raw = [];
  let after = null;
  do {
    const page = await gql(token, { since, after, author });
    for (const n of page.nodes) {
      raw.push({ ...n, commitDates: n.defaultBranchRef?.target?.history?.nodes.map((c) => c.committedDate) ?? [] });
    }
    after = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
  } while (after);
  return raw;
}
