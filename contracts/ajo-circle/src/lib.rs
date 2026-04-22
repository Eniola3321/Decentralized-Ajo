#![no_std]

// LIMIT_SYNC_TAG: v1.0.2
// These constants are the canonical source of truth for all circle operational limits.
// Any change here MUST be reflected in lib/validations/circle.ts (same tag version).
// The CI script scripts/check-limit-sync.mjs enforces this automatically.

/// Maximum number of members allowed in a single circle (including organizer).
pub const MAX_MEMBERS: u32 = 20;

/// Minimum contribution amount in stroops (1 XLM = 10_000_000 stroops).
pub const MIN_CONTRIBUTION_AMOUNT: i128 = 10_000_000; // 1 XLM

/// Maximum contribution amount in stroops.
pub const MAX_CONTRIBUTION_AMOUNT: i128 = 100_000_000_000; // 10,000 XLM

/// Minimum frequency between rounds, in days.
pub const MIN_FREQUENCY_DAYS: u32 = 1;

/// Maximum frequency between rounds, in days.
pub const MAX_FREQUENCY_DAYS: u32 = 365;

/// Minimum number of rounds a circle must run.
pub const MIN_ROUNDS: u32 = 2;

/// Maximum number of rounds a circle can run (must equal MAX_MEMBERS).
pub const MAX_ROUNDS: u32 = 20;

/// Early-withdrawal penalty percentage applied to partial withdrawals.
pub const WITHDRAWAL_PENALTY_PERCENT: i128 = 10;

use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Env, Symbol, Address, Map, Vec, BytesN};

// Custom types
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct CircleData {
    pub organizer: Address,
    pub contribution_amount: i128,
    pub frequency_days: u32,
    pub max_rounds: u32,
    pub current_round: u32,
    pub member_count: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MemberData {
    pub address: Address,
    pub total_contributed: i128,
    pub total_withdrawn: i128,
    pub has_received_payout: bool,
    pub status: u32, // 0 = Active, 1 = Inactive, 2 = Exited
}

#[contract]
pub struct AjoCircle;

#[contractimpl]
impl AjoCircle {
    /// Initialize a new Ajo circle
    pub fn initialize_circle(
        env: Env,
        organizer: Address,
        contribution_amount: i128,
        frequency_days: u32,
        max_rounds: u32,
    ) -> Result<(), Symbol> {
        organizer.require_auth();

        // Validate inputs against canonical constants
        if contribution_amount < MIN_CONTRIBUTION_AMOUNT || contribution_amount > MAX_CONTRIBUTION_AMOUNT {
            return Err(symbol_short!("badamt"));
        }
        if frequency_days < MIN_FREQUENCY_DAYS || frequency_days > MAX_FREQUENCY_DAYS {
            return Err(symbol_short!("badfreq"));
        }
        if max_rounds < MIN_ROUNDS || max_rounds > MAX_ROUNDS {
            return Err(symbol_short!("badrnd"));
        }

        // Store circle data
        let circle_key = symbol_short!("circle");
        let circle_data = CircleData {
            organizer: organizer.clone(),
            contribution_amount,
            frequency_days,
            max_rounds,
            current_round: 1,
            member_count: 1, // Organizer is the first member
        };

        env.storage().instance().set(&circle_key, &circle_data);

        // Initialize members map
        let members_key = symbol_short!("members");
        let mut members: Map<Address, MemberData> = Map::new(&env);

        members.set(
            organizer.clone(),
            MemberData {
                address: organizer,
                total_contributed: 0,
                total_withdrawn: 0,
                has_received_payout: false,
                status: 0,
            },
        );

        env.storage().instance().set(&members_key, &members);

        Ok(())
    }

    /// Add a new member to the circle
    pub fn add_member(env: Env, organizer: Address, new_member: Address) -> Result<(), Symbol> {
        organizer.require_auth();

        // Get current circle
        let circle_key = symbol_short!("circle");
        let mut circle: CircleData = env.storage()
            .instance()
            .get(&circle_key)
            .ok_or(symbol_short!("nocircle"))?;

        // Only organizer can add members
        if circle.organizer != organizer {
            return Err(symbol_short!("notauth"));
        }

        // Get members
        let members_key = symbol_short!("members");
        let mut members: Map<Address, MemberData> = env.storage()
            .instance()
            .get(&members_key)
            .ok_or(symbol_short!("nomembers"))?;

        // Check if member already exists
        if members.contains_key(&new_member) {
            return Err(symbol_short!("exists"));
        }

        // Enforce max member cap
        if circle.member_count >= MAX_MEMBERS {
            return Err(symbol_short!("maxmem"));
        }

        // Add new member
        members.set(
            new_member.clone(),
            MemberData {
                address: new_member,
                total_contributed: 0,
                total_withdrawn: 0,
                has_received_payout: false,
                status: 0,
            },
        );

        circle.member_count += 1;

        env.storage().instance().set(&members_key, &members);
        env.storage().instance().set(&circle_key, &circle);

        Ok(())
    }

    /// Record a contribution from a member
    pub fn contribute(env: Env, member: Address, amount: i128) -> Result<(), Symbol> {
        member.require_auth();

        if amount <= 0 {
            return Err(symbol_short!("badamt"));
        }

        // Get circle
        let circle_key = symbol_short!("circle");
        let circle: CircleData = env.storage()
            .instance()
            .get(&circle_key)
            .ok_or(symbol_short!("nocircle"))?;

        // Get members
        let members_key = symbol_short!("members");
        let mut members: Map<Address, MemberData> = env.storage()
            .instance()
            .get(&members_key)
            .ok_or(symbol_short!("nomembers"))?;

        // Update member contribution
        if let Some(mut member_data) = members.get(&member) {
            member_data.total_contributed += amount;
            members.set(member.clone(), member_data);
        } else {
            return Err(symbol_short!("notmem"));
        }

        env.storage().instance().set(&members_key, &members);

        Ok(())
    }

    /// Claim payout when it's a member's turn
    pub fn claim_payout(env: Env, member: Address) -> Result<i128, Symbol> {
        member.require_auth();

        // Get circle
        let circle_key = symbol_short!("circle");
        let circle: CircleData = env.storage()
            .instance()
            .get(&circle_key)
            .ok_or(symbol_short!("nocircle"))?;

        // Get members
        let members_key = symbol_short!("members");
        let mut members: Map<Address, MemberData> = env.storage()
            .instance()
            .get(&members_key)
            .ok_or(symbol_short!("nomembers"))?;

        // Check if member exists and is eligible
        if let Some(mut member_data) = members.get(&member) {
            if member_data.has_received_payout {
                return Err(symbol_short!("alpaid"));
            }

            // Calculate payout: total member count * contribution amount
            let payout = (circle.member_count as i128) * circle.contribution_amount;

            member_data.has_received_payout = true;
            member_data.total_withdrawn += payout;

            members.set(member, member_data);
            env.storage().instance().set(&members_key, &members);

            Ok(payout)
        } else {
            Err(symbol_short!("notmem"))
        }
    }

    /// Perform a partial withdrawal with penalty
    pub fn partial_withdraw(
        env: Env,
        member: Address,
        amount: i128,
    ) -> Result<i128, Symbol> {
        member.require_auth();

        if amount <= 0 {
            return Err(symbol_short!("badamt"));
        }

        // Get members
        let members_key = symbol_short!("members");
        let mut members: Map<Address, MemberData> = env.storage()
            .instance()
            .get(&members_key)
            .ok_or(symbol_short!("nomembers"))?;

        if let Some(mut member_data) = members.get(&member) {
            let available = member_data.total_contributed - member_data.total_withdrawn;

            if amount > available {
                return Err(symbol_short!("insufund"));
            }

            // Apply canonical withdrawal penalty
            let penalty = (amount * WITHDRAWAL_PENALTY_PERCENT) / 100;
            let net_amount = amount - penalty;

            member_data.total_withdrawn += amount;

            members.set(member, member_data);
            env.storage().instance().set(&members_key, &members);

            Ok(net_amount)
        } else {
            Err(symbol_short!("notmem"))
        }
    }

    /// Get circle state
    pub fn get_circle_state(env: Env) -> Result<CircleData, Symbol> {
        let circle_key = symbol_short!("circle");
        env.storage()
            .instance()
            .get(&circle_key)
            .ok_or(symbol_short!("nocircle"))
    }

    /// Get member balance and status
    pub fn get_member_balance(env: Env, member: Address) -> Result<MemberData, Symbol> {
        let members_key = symbol_short!("members");
        let members: Map<Address, MemberData> = env.storage()
            .instance()
            .get(&members_key)
            .ok_or(symbol_short!("nomembers"))?;

        members
            .get(&member)
            .ok_or(symbol_short!("notmem"))
    }

    /// Get all members
    pub fn get_members(env: Env) -> Result<Vec<MemberData>, Symbol> {
        let members_key = symbol_short!("members");
        let members: Map<Address, MemberData> = env.storage()
            .instance()
            .get(&members_key)
            .ok_or(symbol_short!("nomembers"))?;

        let mut members_vec = Vec::new(&env);
        for (_, member) in members.iter() {
            members_vec.push_back(member);
        }

        Ok(members_vec)
    }
}

mod test;
