use anchor_lang::prelude::*;

declare_id!("J1gUW4ZJwSeff33p5kvMLzPHtNMwCy4D7BAPizQzNGjB");

#[program]
pub mod jiagon_credit {
    use super::*;

    pub fn initialize_verifier_config(
        ctx: Context<InitializeVerifierConfig>,
        verifier: Pubkey,
        metaplex_core_program: Pubkey,
    ) -> Result<()> {
        require_keys_neq!(verifier, Pubkey::default(), JiagonError::ZeroAddress);
        require_keys_neq!(metaplex_core_program, Pubkey::default(), JiagonError::ZeroAddress);

        let config = &mut ctx.accounts.verifier_config;
        config.admin = ctx.accounts.admin.key();
        config.verifier = verifier;
        config.metaplex_core_program = metaplex_core_program;
        config.bump = ctx.bumps.verifier_config;
        Ok(())
    }

    pub fn set_verifier(ctx: Context<SetVerifier>, verifier: Pubkey) -> Result<()> {
        require_keys_neq!(verifier, Pubkey::default(), JiagonError::ZeroAddress);

        ctx.accounts.verifier_config.verifier = verifier;
        Ok(())
    }

    pub fn initialize_credit_state(ctx: Context<InitializeCreditState>) -> Result<()> {
        let state = &mut ctx.accounts.credit_state;
        state.owner = ctx.accounts.owner.key();
        state.receipt_count = 0;
        state.total_spend_cents = 0;
        state.score = 0;
        state.available_credit_cents = 0;
        state.bump = ctx.bumps.credit_state;
        state.updated_at = Clock::get()?.unix_timestamp;
        Ok(())
    }

    pub fn record_receipt(
        ctx: Context<RecordReceipt>,
        source_receipt_hash: [u8; 32],
        data_hash: [u8; 32],
        spend_cents: u64,
        proof_level: u8,
    ) -> Result<()> {
        require!(spend_cents > 0, JiagonError::InvalidSpend);
        require!(proof_level >= 3, JiagonError::InsufficientProof);
        require_keys_eq!(
            *ctx.accounts.core_asset.owner,
            ctx.accounts.verifier_config.metaplex_core_program,
            JiagonError::InvalidCoreAsset
        );

        let receipt = &mut ctx.accounts.receipt;
        receipt.owner = ctx.accounts.owner.key();
        receipt.source_receipt_hash = source_receipt_hash;
        receipt.data_hash = data_hash;
        receipt.spend_cents = spend_cents;
        receipt.proof_level = proof_level;
        receipt.core_asset = ctx.accounts.core_asset.key();
        receipt.bump = ctx.bumps.receipt;
        receipt.created_at = Clock::get()?.unix_timestamp;

        let state = &mut ctx.accounts.credit_state;
        state.receipt_count = state.receipt_count.saturating_add(1);
        state.total_spend_cents = state.total_spend_cents.saturating_add(spend_cents);
        state.score = score_for(state.receipt_count, state.total_spend_cents);
        state.available_credit_cents = credit_for(state.score);
        state.updated_at = Clock::get()?.unix_timestamp;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeVerifierConfig<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        init,
        payer = admin,
        space = 8 + VerifierConfig::INIT_SPACE,
        seeds = [b"jiagon-verifier-config"],
        bump
    )]
    pub verifier_config: Account<'info, VerifierConfig>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetVerifier<'info> {
    pub admin: Signer<'info>,
    #[account(
        mut,
        seeds = [b"jiagon-verifier-config"],
        bump = verifier_config.bump,
        has_one = admin @ JiagonError::UnauthorizedVerifier
    )]
    pub verifier_config: Account<'info, VerifierConfig>,
}

#[derive(Accounts)]
pub struct InitializeCreditState<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        init,
        payer = owner,
        space = 8 + CreditState::INIT_SPACE,
        seeds = [b"jiagon-credit-state", owner.key().as_ref()],
        bump
    )]
    pub credit_state: Account<'info, CreditState>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(source_receipt_hash: [u8; 32])]
pub struct RecordReceipt<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    /// CHECK: Receipt owner can be a delegated wallet controlled by the app.
    pub owner: UncheckedAccount<'info>,
    #[account(
        seeds = [b"jiagon-verifier-config"],
        bump = verifier_config.bump,
        constraint = verifier_config.verifier == authority.key() @ JiagonError::UnauthorizedVerifier
    )]
    pub verifier_config: Account<'info, VerifierConfig>,
    #[account(
        mut,
        seeds = [b"jiagon-credit-state", owner.key().as_ref()],
        bump = credit_state.bump,
        constraint = credit_state.owner == owner.key() @ JiagonError::OwnerMismatch
    )]
    pub credit_state: Account<'info, CreditState>,
    #[account(
        init,
        payer = authority,
        space = 8 + ReceiptRecord::INIT_SPACE,
        seeds = [b"jiagon-receipt", owner.key().as_ref(), source_receipt_hash.as_ref()],
        bump
    )]
    pub receipt: Account<'info, ReceiptRecord>,
    /// CHECK: The program checks that this account is owned by the configured Metaplex Core program.
    pub core_asset: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
#[derive(InitSpace)]
pub struct VerifierConfig {
    pub admin: Pubkey,
    pub verifier: Pubkey,
    pub metaplex_core_program: Pubkey,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct CreditState {
    pub owner: Pubkey,
    pub receipt_count: u32,
    pub total_spend_cents: u64,
    pub score: u16,
    pub available_credit_cents: u64,
    pub updated_at: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct ReceiptRecord {
    pub owner: Pubkey,
    pub source_receipt_hash: [u8; 32],
    pub data_hash: [u8; 32],
    pub spend_cents: u64,
    pub proof_level: u8,
    pub core_asset: Pubkey,
    pub created_at: i64,
    pub bump: u8,
}

#[error_code]
pub enum JiagonError {
    #[msg("Spend amount must be greater than zero.")]
    InvalidSpend,
    #[msg("Receipt proof level is not high enough for credit state.")]
    InsufficientProof,
    #[msg("Verifier is not authorized to record Jiagon receipts.")]
    UnauthorizedVerifier,
    #[msg("Credit state owner does not match receipt owner.")]
    OwnerMismatch,
    #[msg("Core asset is not owned by the configured Metaplex Core program.")]
    InvalidCoreAsset,
    #[msg("Configured public key cannot be the zero address.")]
    ZeroAddress,
}

fn score_for(receipt_count: u32, total_spend_cents: u64) -> u16 {
    let receipt_points = receipt_count.saturating_mul(28);
    let spend_points = (total_spend_cents / 100).min(44) as u32;
    receipt_points.saturating_add(spend_points).min(100) as u16
}

fn credit_for(score: u16) -> u64 {
    if score >= 70 {
        10_000
    } else if score >= 35 {
        5_000
    } else if score > 0 {
        2_500
    } else {
        0
    }
}
