import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken, extractToken } from '@/lib/auth';

const USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  bio: true,
  phoneNumber: true,
  profilePicture: true,
  walletAddress: true,
  createdAt: true,
};

// GET - Fetch current user profile
export async function GET(request: NextRequest) {
  try {
    const token = extractToken(request.headers.get('authorization'));
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: USER_SELECT,
    });

    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    return NextResponse.json({ success: true, user });
  } catch (error) {
    console.error('Get profile error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update current user profile
export async function PUT(request: NextRequest) {
  try {
    const token = extractToken(request.headers.get('authorization'));
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });

    const body = await request.json();
    const { firstName, lastName, bio, phoneNumber } = body;

    if (firstName !== undefined && firstName.trim().length < 2) {
      return NextResponse.json({ error: 'First name must be at least 2 characters' }, { status: 400 });
    }
    if (lastName !== undefined && lastName.trim().length < 2) {
      return NextResponse.json({ error: 'Last name must be at least 2 characters' }, { status: 400 });
    }
    if (bio !== undefined && bio.length > 160) {
      return NextResponse.json({ error: 'Bio must be 160 characters or less' }, { status: 400 });
    }

    const user = await prisma.user.update({
      where: { id: payload.userId },
      data: {
        ...(firstName !== undefined && { firstName: firstName.trim() }),
        ...(lastName !== undefined && { lastName: lastName.trim() }),
        ...(bio !== undefined && { bio }),
        ...(phoneNumber !== undefined && { phoneNumber }),
      },
      select: USER_SELECT,
    });

    return NextResponse.json({ success: true, user });
  } catch (error) {
    console.error('Update profile error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
