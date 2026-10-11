/**
 * MemoSphere Supabase Client & Helper Functions
 * Provides initialization, CRUD operations, and connection testing
 */

let __msClientCache = null;
let __msClientCacheKey = null;

function getSupabase() {
    const supabaseUrl = localStorage.getItem('SUPABASE_URL') || '';
    const supabaseKey = localStorage.getItem('SUPABASE_ANON_KEY') || '';

    if (!supabaseUrl || !supabaseKey) {
        console.error('❌ Supabase credentials not found in localStorage');
        return null;
    }

    if (!window.supabase) {
        console.error('❌ Supabase JS client not loaded from CDN');
        return null;
    }

    // Reuse a single client instance (same URL+key) so the Supabase Auth
    // session/listeners are consistent across the whole app instead of a
    // fresh, session-less client being created on every call.
    const cacheKey = supabaseUrl + '|' + supabaseKey;
    if (__msClientCache && __msClientCacheKey === cacheKey) {
        return __msClientCache;
    }

    try {
        const { createClient } = window.supabase;
        __msClientCache = createClient(supabaseUrl, supabaseKey);
        __msClientCacheKey = cacheKey;
        return __msClientCache;
    } catch (err) {
        console.error('❌ Failed to create Supabase client:', err.message);
        return null;
    }
}

async function testConnection() {
    try {
        const client = getSupabase();
        if (!client) {
            console.error('❌ Supabase client not initialized');
            return false;
        }

        const { data, error } = await client
            .from('app_config')
            .select('*')
            .limit(1);

        if (error && error.code !== 'PGRST116') {
            console.error('❌ Connection test failed:', error.message);
            return false;
        }

        console.log('✅ Supabase connection successful');
        return true;
    } catch (err) {
        console.error('❌ Connection test error:', err.message);
        return false;
    }
}

async function getAllRows(table) {
    try {
        const client = getSupabase();
        if (!client) throw new Error('Supabase client not initialized');

        const { data, error } = await client.from(table).select('*');
        if (error) throw error;
        return data;
    } catch (err) {
        console.error(`❌ Error fetching ${table}:`, err.message);
        return [];
    }
}

async function getRowById(table, id) {
    try {
        const client = getSupabase();
        if (!client) throw new Error('Supabase client not initialized');

        const { data, error } = await client
            .from(table)
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        return data;
    } catch (err) {
        console.error(`❌ Error fetching ${table} with id ${id}:`, err.message);
        return null;
    }
}

async function insertRow(table, rowData) {
    try {
        const client = getSupabase();
        if (!client) throw new Error('Supabase client not initialized');

        const { data, error } = await client
            .from(table)
            .insert([rowData])
            .select();

        if (error) throw error;
        console.log(`✅ Row inserted into ${table}:`, data);
        return data;
    } catch (err) {
        console.error(`❌ Error inserting into ${table}:`, err.message);
        return null;
    }
}

async function updateRow(table, id, updates) {
    try {
        const client = getSupabase();
        if (!client) throw new Error('Supabase client not initialized');

        const { data, error } = await client
            .from(table)
            .update(updates)
            .eq('id', id)
            .select();

        if (error) throw error;
        console.log(`✅ Row updated in ${table}:`, data);
        return data;
    } catch (err) {
        console.error(`❌ Error updating ${table}:`, err.message);
        return null;
    }
}

async function updateRowBy(table, column, value, updates) {
    try {
        const client = getSupabase();
        if (!client) throw new Error('Supabase client not initialized');

        const { data, error } = await client
            .from(table)
            .update(updates)
            .eq(column, value)
            .select();

        if (error) throw error;
        console.log(`✅ Row updated in ${table} where ${column}=${value}:`, data);
        return data;
    } catch (err) {
        console.error(`❌ Error updating ${table} where ${column}=${value}:`, err.message);
        return null;
    }
}

async function upsertRow(table, matchColumn, matchValue, rowData) {
    try {
        const client = getSupabase();
        if (!client) throw new Error('Supabase client not initialized');

        const { data: existing, error: selectError } = await client
            .from(table)
            .select('id')
            .eq(matchColumn, matchValue)
            .maybeSingle();

        if (selectError) throw selectError;

        if (existing && existing.id) {
            const { data, error } = await client
                .from(table)
                .update(rowData)
                .eq('id', existing.id)
                .select();
            if (error) throw error;
            return data;
        } else {
            const { data, error } = await client
                .from(table)
                .insert([{ [matchColumn]: matchValue, ...rowData }])
                .select();
            if (error) throw error;
            return data;
        }
    } catch (err) {
        console.error(`❌ Error upserting into ${table}:`, err.message);
        return null;
    }
}

async function deleteRow(table, id) {
    try {
        const client = getSupabase();
        if (!client) throw new Error('Supabase client not initialized');

        const { error } = await client
            .from(table)
            .delete()
            .eq('id', id);

        if (error) throw error;
        console.log(`✅ Row deleted from ${table}`);
        return true;
    } catch (err) {
        console.error(`❌ Error deleting from ${table}:`, err.message);
        return false;
    }
}

async function deleteWhere(table, column, value) {
    try {
        const client = getSupabase();
        if (!client) throw new Error('Supabase client not initialized');

        const { error } = await client
            .from(table)
            .delete()
            .eq(column, value);

        if (error) throw error;
        console.log(`✅ Rows deleted from ${table} where ${column} = ${value}`);
        return true;
    } catch (err) {
        console.error(`❌ Error deleting from ${table} where ${column} = ${value}:`, err.message);
        return false;
    }
}

function subscribeToTable(table, callback) {
    try {
        const client = getSupabase();
        if (!client) throw new Error('Supabase client not initialized');

        const subscription = client
            .channel(`public:${table}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: table
                },
                (payload) => {
                    console.log(`📡 ${table} updated:`, payload);
                    callback(payload);
                }
            )
            .subscribe();

        console.log(`✅ Subscribed to ${table}`);
        return subscription;
    } catch (err) {
        console.error(`❌ Error subscribing to ${table}:`, err.message);
        return null;
    }
}

async function authGetSession() {
    const client = getSupabase();
    if (!client) return null;
    const { data, error } = await client.auth.getSession();
    if (error) {
        console.error('❌ Error getting session:', error.message);
        return null;
    }
    return data.session;
}

function authOnChange(callback) {
    const client = getSupabase();
    if (!client) return null;
    const { data } = client.auth.onAuthStateChange((_event, session) => callback(session));
    return data.subscription;
}

async function authSignIn(email, password) {
    const client = getSupabase();
    if (!client) return { error: { message: 'Supabase client not initialized' } };
    return await client.auth.signInWithPassword({ email, password });
}

async function authSignUp(email, password) {
    const client = getSupabase();
    if (!client) return { error: { message: 'Supabase client not initialized' } };
    return await client.auth.signUp({ email, password });
}

async function authSignOut() {
    const client = getSupabase();
    if (!client) return;
    await client.auth.signOut();
}

async function getMyProfile() {
    try {
        const client = getSupabase();
        if (!client) return null;
        const { data: userData, error: userErr } = await client.auth.getUser();
        if (userErr || !userData?.user) return null;
        const { data, error } = await client
            .from('profiles')
            .select('*')
            .eq('id', userData.user.id)
            .single();
        if (error) throw error;
        return data;
    } catch (err) {
        console.error('❌ Error fetching my profile:', err.message);
        return null;
    }
}

async function listProfiles() {
    try {
        const client = getSupabase();
        if (!client) return [];
        const { data, error } = await client
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: true });
        if (error) throw error;
        return data || [];
    } catch (err) {
        console.error('❌ Error listing profiles:', err.message);
        return [];
    }
}

async function createMember({ email, password, role, display_name }) {
    try {
        const client = getSupabase();
        if (!client) return { error: { message: 'Supabase client not initialized' } };
        const { data, error } = await client.functions.invoke('create-member', {
            body: { email, password, role, display_name }
        });
        if (error) {
            // supabase-js wraps non-2xx responses in a generic error; try to recover the real message
            let message = error.message || 'Failed to create member';
            if (error.context && typeof error.context.json === 'function') {
                try {
                    const body = await error.context.json();
                    if (body?.error) message = body.error;
                } catch (_) { /* ignore */ }
            }
            return { error: { message } };
        }
        if (data?.error) {
            return { error: { message: data.error } };
        }
        return { data };
    } catch (err) {
        console.error('❌ Error creating member:', err.message);
        return { error: { message: err.message } };
    }
}

async function anyProfilesExist() {
    try {
        const client = getSupabase();
        if (!client) return true; // fail safe: hide signup if we can't tell
        const { data, error } = await client.rpc('any_profiles_exist');
        if (error) {
            console.error('❌ Error checking any_profiles_exist:', error.message);
            return true;
        }
        return !!data;
    } catch (err) {
        console.error('❌ Error checking any_profiles_exist:', err.message);
        return true;
    }
}

window.MemoSphereSupabase = {
    getSupabase,
    testConnection,
    getAllRows,
    getRowById,
    insertRow,
    updateRow,
    updateRowBy,
    upsertRow,
    deleteRow,
    deleteWhere,
    subscribeToTable,
    authGetSession,
    authOnChange,
    authSignIn,
    authSignUp,
    authSignOut,
    anyProfilesExist,
    getMyProfile,
    listProfiles,
    createMember
};

console.log('✅ MemoSphere Supabase utilities loaded');
