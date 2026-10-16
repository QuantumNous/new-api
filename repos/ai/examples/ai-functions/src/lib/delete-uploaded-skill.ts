export async function deleteUploadedOpenAISkill({
  providerReference,
}: {
  providerReference: Record<string, string>;
}) {
  const skillId = providerReference.openai;
  if (skillId == null) {
    throw new Error('Missing OpenAI skill ID in providerReference.');
  }

  const response = await fetch(`https://api.openai.com/v1/skills/${skillId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Failed to delete OpenAI skill ${skillId}: ${response.status} ${body}`,
    );
  }
}

export async function deleteUploadedAnthropicSkill({
  providerReference,
}: {
  providerReference: Record<string, string>;
}) {
  const skillId = providerReference.anthropic;
  if (skillId == null) {
    throw new Error('Missing Anthropic skill ID in providerReference.');
  }

  const headers = {
    'x-api-key': process.env.ANTHROPIC_API_KEY ?? '',
    'anthropic-version': '2023-06-01',
    'anthropic-beta': 'skills-2025-10-02',
  };

  const versionsResponse = await fetch(
    `https://api.anthropic.com/v1/skills/${skillId}/versions`,
    { headers },
  );
  if (!versionsResponse.ok) {
    const body = await versionsResponse.text();
    throw new Error(
      `Failed to list Anthropic skill versions for ${skillId}: ${versionsResponse.status} ${body}`,
    );
  }

  const versions = (await versionsResponse.json()) as {
    data?: Array<{ version: string }>;
  };

  for (const version of versions.data ?? []) {
    const deleteVersionResponse = await fetch(
      `https://api.anthropic.com/v1/skills/${skillId}/versions/${version.version}`,
      {
        method: 'DELETE',
        headers,
      },
    );
    if (!deleteVersionResponse.ok) {
      const body = await deleteVersionResponse.text();
      throw new Error(
        `Failed to delete Anthropic skill version ${version.version} for ${skillId}: ${deleteVersionResponse.status} ${body}`,
      );
    }
  }

  const deleteSkillResponse = await fetch(
    `https://api.anthropic.com/v1/skills/${skillId}`,
    {
      method: 'DELETE',
      headers,
    },
  );
  if (!deleteSkillResponse.ok) {
    const body = await deleteSkillResponse.text();
    throw new Error(
      `Failed to delete Anthropic skill ${skillId}: ${deleteSkillResponse.status} ${body}`,
    );
  }
}
