import { NextRequest, NextResponse } from 'next/server';
import { createPlayer, listPlayers, updatePlayerScore } from '../../../lib/db';
import { calculateCompetitiveScore } from '../../../core/DevFestArcadeManager';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[\d\s+\-().]{5,30}$/;

function escapeCsvField(value: string | number | null): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(request: NextRequest) {
  try {
    const players = listPlayers();
    const format = request.nextUrl.searchParams.get('format');

    if (format === 'csv') {
      const headers = [
        'id',
        'name',
        'email',
        'phone',
        'points',
        'score',
        'total_time_sec',
        'avg_accuracy',
        'attempts',
        'created_at',
      ];
      const rows = players.map((p) =>
        [
          p.id,
          p.name,
          p.email,
          p.phone,
          p.points,
          p.score,
          p.total_time_sec,
          p.avg_accuracy,
          p.attempts,
          p.created_at,
        ]
          .map(escapeCsvField)
          .join(',')
      );
      const csv = [headers.join(','), ...rows].join('\n');

      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="players.csv"',
        },
      });
    }

    return NextResponse.json({ players }, { status: 200 });
  } catch (err) {
    console.error('Failed to list players:', err);
    return NextResponse.json({ error: 'Failed to load players' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';

    if (!name) {
      return NextResponse.json({ error: 'Player name is required' }, { status: 400 });
    }
    if (name.length > 60) {
      return NextResponse.json(
        { error: 'Player name must be 60 characters or fewer' },
        { status: 400 }
      );
    }

    if (!email || !EMAIL_REGEX.test(email)) {
      return NextResponse.json(
        { error: 'Please enter a valid email address' },
        { status: 400 }
      );
    }
    if (email.length > 120) {
      return NextResponse.json(
        { error: 'Email must be 120 characters or fewer' },
        { status: 400 }
      );
    }

    if (phone && !PHONE_REGEX.test(phone)) {
      return NextResponse.json(
        { error: 'Please enter a valid phone number or leave it blank' },
        { status: 400 }
      );
    }

    const player = createPlayer({
      name,
      email,
      phone: phone || null,
    });

    return NextResponse.json({ player }, { status: 201 });
  } catch (err) {
    console.error('Failed to register player:', err);
    return NextResponse.json({ error: 'Failed to save player registration' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const id = Number(body.id);
    const score = Number(body.score);
    const totalTimeSec = Number(body.totalTimeSec);
    const avgAccuracy = Number(body.avgAccuracy);

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: 'Valid player id is required' }, { status: 400 });
    }
    if (!Number.isFinite(score) || !Number.isFinite(totalTimeSec) || !Number.isFinite(avgAccuracy)) {
      return NextResponse.json({ error: 'Valid score metrics are required' }, { status: 400 });
    }

    const points = Number.isFinite(Number(body.points))
      ? Math.round(Number(body.points))
      : calculateCompetitiveScore(score, avgAccuracy, totalTimeSec);
    const attempts =
      Number.isInteger(Number(body.attempts)) && Number(body.attempts) >= 1
        ? Math.min(3, Number(body.attempts))
        : 1;

    const updated = updatePlayerScore({ id, points, score, totalTimeSec, avgAccuracy, attempts });
    if (!updated) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    return NextResponse.json({ player: updated }, { status: 200 });
  } catch (err) {
    console.error('Failed to update player score:', err);
    return NextResponse.json({ error: 'Failed to update player score' }, { status: 500 });
  }
}
