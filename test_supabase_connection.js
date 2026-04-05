const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function testSupabaseConnection() {
    console.log('Testing Supabase connection...');
    
    // Check if environment variables are set
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
        console.error('❌ NEXT_PUBLIC_SUPABASE_URL is not set');
        return;
    }
    
    if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        console.error('❌ NEXT_PUBLIC_SUPABASE_ANON_KEY is not set');
        return;
    }
    
    console.log('✅ Environment variables are set');
    console.log('URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
    console.log('Anon Key (first 20 chars):', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.substring(0, 20) + '...');
    
    try {
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        );
        
        // Test basic connection
        const { data, error } = await supabase.from('profiles').select('count').limit(1);
        
        if (error) {
            console.error('❌ Connection failed:', error.message);
        } else {
            console.log('✅ Successfully connected to Supabase!');
            console.log('✅ Database tables are accessible');
        }
    } catch (err) {
        console.error('❌ Connection error:', err.message);
    }
}

testSupabaseConnection();