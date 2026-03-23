import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken, extractToken } from '@/lib/auth';

// POST - Create a new circle
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = extractToken(authHeader);

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      name,
      description,
      contributionAmount,
      contributionFrequencyDays,
      maxRounds,
    } = body;

    // Validate inputs
    if (!name || contributionAmount <= 0 || contributionFrequencyDays <= 0 || maxRounds <= 0) {
      return NextResponse.json(
        { error: 'Invalid input parameters' },
        { status: 400 }
      );
    }

    // Create circle
    const circle = await prisma.circle.create({
      data: {
        name,
        description,
        organizerId: payload.userId,
        contributionAmount,
        contributionFrequencyDays,
        maxRounds,
      },
      include: {
        organizer: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        members: true,
      },
    });

    // Add organizer as first member
    await prisma.circleMember.create({
      data: {
        circleId: circle.id,
        userId: payload.userId,
        rotationOrder: 1,
      },
    });

    return NextResponse.json(
      {
        success: true,
        circle,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create circle error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET - List circles
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = extractToken(authHeader);

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // Extract query parameters
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';

    // Build the query where clause
    const whereClause: any = {
      OR: [
        { organizerId: payload.userId },
        {
          members: {
            some: {
              userId: payload.userId,
            },
          },
        },
      ],
    };

    // Add search filter if provided
    if (search) {
      whereClause.AND = [
        ...(whereClause.AND || []),
        {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
          ],
        },
      ];
    }

    // Add status filter if provided and not 'ALL'
    if (status && status.toUpperCase() !== 'ALL') {
      whereClause.AND = [
        ...(whereClause.AND || []),
        { status: status.charAt(0).toUpperCase() + status.slice(1).toLowerCase() },
      ];
    }

    // Get user's circles
    const circles = await prisma.circle.findMany({
      where: whereClause,
      include: {
        organizer: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        contributions: {
          select: {
            amount: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(
      {
        success: true,
        circles,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('List circles error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
