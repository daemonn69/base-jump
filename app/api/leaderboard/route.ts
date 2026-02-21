import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

    // We fallback to empty array if no config
    if (!url || !token) {
        console.log("Redis not configured properly. Missing UPSTASH_ENV or KV_ENV var.");
        return NextResponse.json([{ fid: "MISSING_ENV_VARS_LOCALLY", score: 0 }]);
    }

    try {
        const res = await fetch(url, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(["ZREVRANGE", "base_jump_leaderboard", "0", "19", "WITHSCORES"]),
            next: { revalidate: 0 }
        });

        const body = await res.json();
        if (body.error) {
            throw new Error(body.error);
        }

        const leaderboard = body.result || [];
        const formattedLeaderboard = [];

        // The format returned by withScores is [member1, score1, member2, score2...]
        for (let i = 0; i < leaderboard.length; i += 2) {
            formattedLeaderboard.push({
                fid: leaderboard[i],
                score: Number(leaderboard[i + 1])
            });
        }

        return NextResponse.json(formattedLeaderboard);
    } catch (error) {
        console.error('Failed to fetch leaderboard:', error);
        return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
        return NextResponse.json({ error: 'Redis is not configured' }, { status: 500 });
    }

    try {
        const { fid, score } = await request.json();

        if (!fid || typeof score !== 'number') {
            return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
        }

        // ZSCORE to get current score using JSON body for Vercel KV compat
        const scoreRes = await fetch(url, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify(["ZSCORE", "base_jump_leaderboard", fid.toString()])
        });
        const scoreBody = await scoreRes.json();
        const currentScore = scoreBody.result; // could be null if no score exists

        // Only update if new score is higher
        if (currentScore === null || score > Number(currentScore)) {
            await fetch(url, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify(["ZADD", "base_jump_leaderboard", score.toString(), fid.toString()])
            });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to save score:', error);
        return NextResponse.json({ error: 'Failed to save score' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
        return NextResponse.json({ error: 'Redis is not configured' }, { status: 500 });
    }

    try {
        const { fid } = await request.json();
        if (!fid) return NextResponse.json({ error: 'Invalid data' }, { status: 400 });

        await fetch(url, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify(["ZREM", "base_jump_leaderboard", fid.toString()])
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
