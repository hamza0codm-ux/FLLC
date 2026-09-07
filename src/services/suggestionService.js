const SUGGESTION_DB_KEY = 'fruity:suggestions';

export async function getSuggestions(client) {
    if (!client?.db) {
        throw new Error('Database is not available.');
    }

    const data = await client.db.get(SUGGESTION_DB_KEY, {});

    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return {};
    }

    return data;
}

export async function getSuggestion(client, suggestionId) {
    const suggestions = await getSuggestions(client);
    return suggestions[suggestionId] || null;
}

export async function saveSuggestion(client, suggestion) {
    const suggestions = await getSuggestions(client);

    suggestions[suggestion.id] = suggestion;

    await client.db.set(SUGGESTION_DB_KEY, suggestions);

    return suggestion;
}

export async function updateSuggestion(client, suggestionId, updates) {
    const suggestions = await getSuggestions(client);

    if (!suggestions[suggestionId]) {
        return null;
    }

    suggestions[suggestionId] = {
        ...suggestions[suggestionId],
        ...updates,
    };

    await client.db.set(SUGGESTION_DB_KEY, suggestions);

    return suggestions[suggestionId];
}

export async function getUserSuggestions(client, userId) {
    const suggestions = await getSuggestions(client);

    return Object.values(suggestions)
        .filter(suggestion => suggestion.userId === userId)
        .sort((a, b) => b.createdAt - a.createdAt);
}

export function createSuggestionId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
