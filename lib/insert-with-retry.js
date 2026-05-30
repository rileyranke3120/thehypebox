export async function insertWithRetry(supabase, table, data, { tag = table, retries = 3 } = {}) {
  for (let i = 0; i < retries; i++) {
    const { error } = await supabase.from(table).insert(data);
    if (!error) return;
    if (i < retries - 1) await new Promise((r) => setTimeout(r, 300 * (i + 1)));
    else console.error(`[${tag}] insert failed after ${retries} attempts:`, error.message);
  }
}
