import Link from 'next/link'
import {
  CircleDot,
  LayoutGrid,
  Receipt,
  SearchX,
  Users,
  Wallet,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'

// ─── 2.1 UnauthenticatedDashboardEmpty ───────────────────────────────────────

interface UnauthenticatedDashboardEmptyProps {
  onConnect: () => void
  isConnecting?: boolean
}

export function UnauthenticatedDashboardEmpty({
  onConnect,
  isConnecting = false,
}: UnauthenticatedDashboardEmptyProps) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Wallet aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>Connect Your Wallet</EmptyTitle>
        <EmptyDescription>
          Connect your Stellar wallet to view your Ajo groups, pooled balances,
          and upcoming payment cycles.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button
          onClick={onConnect}
          disabled={isConnecting}
          aria-disabled={isConnecting ? 'true' : undefined}
          aria-busy={isConnecting ? 'true' : undefined}
          isLoading={isConnecting}
        >
          {isConnecting ? 'Connecting…' : 'Connect Wallet'}
        </Button>
      </EmptyContent>
    </Empty>
  )
}

// ─── 2.2 NoActiveGroupsEmpty ──────────────────────────────────────────────────

export function NoActiveGroupsEmpty() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Users aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>No Active Groups</EmptyTitle>
        <EmptyDescription>
          You haven&apos;t joined any active Ajo circles yet. Create or join one
          to get started.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild>
          <Link href="/circles/join">Find Ajo Groups</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/circles/create">Create a Circle</Link>
        </Button>
      </EmptyContent>
    </Empty>
  )
}

// ─── 2.3 NoUserAjosEmpty ──────────────────────────────────────────────────────

export function NoUserAjosEmpty() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <CircleDot aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>No Ajo Groups Yet</EmptyTitle>
        <EmptyDescription>
          You haven&apos;t joined any Ajo groups. Browse available groups to get
          started.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild>
          <Link href="/circles/join">Browse Ajos</Link>
        </Button>
      </EmptyContent>
    </Empty>
  )
}

// ─── 2.4 NoCirclesFilteredEmpty ───────────────────────────────────────────────

interface NoCirclesFilteredEmptyProps {
  onClearFilters: () => void
}

export function NoCirclesFilteredEmpty({
  onClearFilters,
}: NoCirclesFilteredEmptyProps) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SearchX aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>No circles found</EmptyTitle>
        <EmptyDescription>
          No circles match your current search or filter. Try adjusting your
          criteria.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button onClick={onClearFilters}>Clear filters</Button>
      </EmptyContent>
    </Empty>
  )
}

// ─── 2.5 NoCirclesAllEmpty ────────────────────────────────────────────────────

export function NoCirclesAllEmpty() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <LayoutGrid aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>No circles yet</EmptyTitle>
        <EmptyDescription>
          There are no circles to browse. Create one or join an existing circle
          to get started.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild>
          <Link href="/circles/create">Create a Circle</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/circles/join">Join a Circle</Link>
        </Button>
      </EmptyContent>
    </Empty>
  )
}

// ─── 2.6 NoTransactionsEmpty ──────────────────────────────────────────────────

export function NoTransactionsEmpty() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Receipt aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>No transactions yet</EmptyTitle>
        <EmptyDescription>
          Your contributions will appear here once you join a circle and make a
          payment.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild>
          <Link href="/circles/join">Join a Circle</Link>
        </Button>
      </EmptyContent>
    </Empty>
  )
}
