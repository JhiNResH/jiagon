use anchor_lang::prelude::*;
use anchor_lang::solana_program::pubkey;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("J1gUW4ZJwSeff33p5kvMLzPHtNMwCy4D7BAPizQzNGjB");

const INITIAL_ADMIN: Pubkey = pubkey!("3z6edmobZbGBQP1pxfYi3XuxqEFeZn1rZfGBegtJ2GAh");
const PURPOSE_RESTAURANT_DEPOSIT: [u8; 32] = *b"premium_restaurant_deposit\0\0\0\0\0\0";

#[program]
pub mod jiagon_credit {
    use super::*;

    pub fn initialize_verifier_config(
        ctx: Context<InitializeVerifierConfig>,
        verifier: Pubkey,
        metaplex_core_program: Pubkey,
    ) -> Result<()> {
        require_keys_eq!(
            ctx.accounts.admin.key(),
            INITIAL_ADMIN,
            JiagonError::UnauthorizedAdmin
        );
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

    pub fn initialize_credit_line(ctx: Context<InitializeCreditLine>) -> Result<()> {
        let line = &mut ctx.accounts.credit_line;
        line.owner = ctx.accounts.owner.key();
        line.locked_credit_cents = 0;
        line.repayment_count = 0;
        line.bump = ctx.bumps.credit_line;
        line.updated_at = Clock::get()?.unix_timestamp;
        Ok(())
    }

    pub fn initialize_vault(ctx: Context<InitializeVault>) -> Result<()> {
        require_keys_eq!(
            ctx.accounts.admin.key(),
            INITIAL_ADMIN,
            JiagonError::UnauthorizedAdmin
        );

        let vault = &mut ctx.accounts.vault_config;
        vault.admin = ctx.accounts.admin.key();
        vault.payment_mint = ctx.accounts.payment_mint.key();
        vault.vault_token_account = ctx.accounts.vault_token_account.key();
        vault.merchant_escrow_token_account = ctx.accounts.merchant_escrow_token_account.key();
        vault.vault_authority_bump = ctx.bumps.vault_authority;
        vault.bump = ctx.bumps.vault_config;
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

        let global_receipt = &mut ctx.accounts.global_receipt;
        global_receipt.source_receipt_hash = source_receipt_hash;
        global_receipt.owner = ctx.accounts.owner.key();
        global_receipt.receipt = ctx.accounts.receipt.key();
        global_receipt.bump = ctx.bumps.global_receipt;
        global_receipt.created_at = Clock::get()?.unix_timestamp;

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
        state.receipt_count = state
            .receipt_count
            .checked_add(1)
            .ok_or(JiagonError::ArithmeticOverflow)?;
        state.total_spend_cents = state
            .total_spend_cents
            .checked_add(spend_cents)
            .ok_or(JiagonError::ArithmeticOverflow)?;
        state.score = score_for(state.receipt_count, state.total_spend_cents)?;
        state.available_credit_cents = credit_for(state.score);
        state.updated_at = Clock::get()?.unix_timestamp;
        Ok(())
    }

    pub fn draw_restaurant_deposit(
        ctx: Context<DrawRestaurantDeposit>,
        draw_id: [u8; 16],
        merchant_hash: [u8; 32],
        amount_cents: u64,
        expires_at: i64,
    ) -> Result<()> {
        require!(amount_cents > 0, JiagonError::InvalidDrawAmount);
        require!(
            ctx.accounts.credit_state.available_credit_cents
                >= ctx.accounts.credit_line.locked_credit_cents,
            JiagonError::ArithmeticOverflow
        );
        let available_after_locks = ctx
            .accounts
            .credit_state
            .available_credit_cents
            .checked_sub(ctx.accounts.credit_line.locked_credit_cents)
            .ok_or(JiagonError::ArithmeticOverflow)?;
        require!(amount_cents <= available_after_locks, JiagonError::CreditLimitExceeded);
        require!(expires_at > Clock::get()?.unix_timestamp, JiagonError::InvalidExpiry);
        let token_amount = token_amount_for_cents(amount_cents, ctx.accounts.payment_mint.decimals)?;

        let signer_seeds: &[&[&[u8]]] = &[&[
            b"jiagon-vault-authority",
            &[ctx.accounts.vault_config.vault_authority_bump],
        ]];
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault_token_account.to_account_info(),
                    to: ctx.accounts.merchant_escrow_token_account.to_account_info(),
                    authority: ctx.accounts.vault_authority.to_account_info(),
                },
                signer_seeds,
            ),
            token_amount,
        )?;

        let draw = &mut ctx.accounts.purpose_draw;
        draw.owner = ctx.accounts.owner.key();
        draw.draw_id = draw_id;
        draw.purpose = PURPOSE_RESTAURANT_DEPOSIT;
        draw.merchant_hash = merchant_hash;
        draw.merchant_escrow_token_account = ctx.accounts.merchant_escrow_token_account.key();
        draw.amount_cents = amount_cents;
        draw.token_amount = token_amount;
        draw.status = DrawStatus::Active;
        draw.created_at = Clock::get()?.unix_timestamp;
        draw.expires_at = expires_at;
        draw.repaid_at = 0;
        draw.bump = ctx.bumps.purpose_draw;

        let line = &mut ctx.accounts.credit_line;
        line.locked_credit_cents = line
            .locked_credit_cents
            .checked_add(amount_cents)
            .ok_or(JiagonError::ArithmeticOverflow)?;
        line.updated_at = Clock::get()?.unix_timestamp;
        Ok(())
    }

    pub fn repay_restaurant_deposit(ctx: Context<RepayRestaurantDeposit>) -> Result<()> {
        require!(
            ctx.accounts.purpose_draw.status == DrawStatus::Active,
            JiagonError::DrawNotActive
        );

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.borrower_token_account.to_account_info(),
                    to: ctx.accounts.vault_token_account.to_account_info(),
                    authority: ctx.accounts.owner.to_account_info(),
                },
            ),
            ctx.accounts.purpose_draw.token_amount,
        )?;

        let draw = &mut ctx.accounts.purpose_draw;
        draw.status = DrawStatus::Repaid;
        draw.repaid_at = Clock::get()?.unix_timestamp;

        let line = &mut ctx.accounts.credit_line;
        line.locked_credit_cents = line
            .locked_credit_cents
            .checked_sub(draw.amount_cents)
            .ok_or(JiagonError::ArithmeticOverflow)?;
        line.repayment_count = line
            .repayment_count
            .checked_add(1)
            .ok_or(JiagonError::ArithmeticOverflow)?;
        line.updated_at = Clock::get()?.unix_timestamp;

        let state = &mut ctx.accounts.credit_state;
        state.score = state.score.saturating_add(8).min(100);
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
pub struct InitializeCreditLine<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        init,
        payer = owner,
        space = 8 + CreditLine::INIT_SPACE,
        seeds = [b"jiagon-credit-line", owner.key().as_ref()],
        bump
    )]
    pub credit_line: Account<'info, CreditLine>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitializeVault<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        init,
        payer = admin,
        space = 8 + VaultConfig::INIT_SPACE,
        seeds = [b"jiagon-vault-config"],
        bump
    )]
    pub vault_config: Account<'info, VaultConfig>,
    /// CHECK: PDA authority for the configured token vault.
    #[account(seeds = [b"jiagon-vault-authority"], bump)]
    pub vault_authority: UncheckedAccount<'info>,
    pub payment_mint: Account<'info, Mint>,
    #[account(
        constraint = vault_token_account.mint == payment_mint.key() @ JiagonError::InvalidVault,
        constraint = vault_token_account.owner == vault_authority.key() @ JiagonError::InvalidVault
    )]
    pub vault_token_account: Account<'info, TokenAccount>,
    #[account(
        constraint = merchant_escrow_token_account.mint == payment_mint.key() @ JiagonError::InvalidVault
    )]
    pub merchant_escrow_token_account: Account<'info, TokenAccount>,
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
    #[account(
        init,
        payer = authority,
        space = 8 + ReceiptGlobalRegistry::INIT_SPACE,
        seeds = [b"jiagon-receipt-global", source_receipt_hash.as_ref()],
        bump
    )]
    pub global_receipt: Account<'info, ReceiptGlobalRegistry>,
    /// CHECK: The program checks that this account is owned by the configured Metaplex Core program.
    pub core_asset: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(draw_id: [u8; 16])]
pub struct DrawRestaurantDeposit<'info> {
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
        mut,
        seeds = [b"jiagon-credit-line", owner.key().as_ref()],
        bump = credit_line.bump,
        constraint = credit_line.owner == owner.key() @ JiagonError::OwnerMismatch
    )]
    pub credit_line: Account<'info, CreditLine>,
    #[account(
        init,
        payer = authority,
        space = 8 + PurposeDraw::INIT_SPACE,
        seeds = [b"jiagon-purpose-draw", owner.key().as_ref(), draw_id.as_ref()],
        bump
    )]
    pub purpose_draw: Account<'info, PurposeDraw>,
    #[account(
        seeds = [b"jiagon-vault-config"],
        bump = vault_config.bump,
        has_one = payment_mint @ JiagonError::InvalidVault,
        has_one = vault_token_account @ JiagonError::InvalidVault,
        has_one = merchant_escrow_token_account @ JiagonError::InvalidVault
    )]
    pub vault_config: Account<'info, VaultConfig>,
    /// CHECK: PDA authority for the configured token vault.
    #[account(seeds = [b"jiagon-vault-authority"], bump = vault_config.vault_authority_bump)]
    pub vault_authority: UncheckedAccount<'info>,
    pub payment_mint: Account<'info, Mint>,
    #[account(mut)]
    pub vault_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = merchant_escrow_token_account.mint == payment_mint.key() @ JiagonError::InvalidVault
    )]
    pub merchant_escrow_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RepayRestaurantDeposit<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        mut,
        seeds = [b"jiagon-credit-state", owner.key().as_ref()],
        bump = credit_state.bump,
        constraint = credit_state.owner == owner.key() @ JiagonError::OwnerMismatch
    )]
    pub credit_state: Account<'info, CreditState>,
    #[account(
        mut,
        seeds = [b"jiagon-credit-line", owner.key().as_ref()],
        bump = credit_line.bump,
        constraint = credit_line.owner == owner.key() @ JiagonError::OwnerMismatch
    )]
    pub credit_line: Account<'info, CreditLine>,
    #[account(
        mut,
        seeds = [b"jiagon-purpose-draw", owner.key().as_ref(), purpose_draw.draw_id.as_ref()],
        bump = purpose_draw.bump,
        constraint = purpose_draw.owner == owner.key() @ JiagonError::OwnerMismatch
    )]
    pub purpose_draw: Account<'info, PurposeDraw>,
    #[account(
        seeds = [b"jiagon-vault-config"],
        bump = vault_config.bump,
        has_one = payment_mint @ JiagonError::InvalidVault,
        has_one = vault_token_account @ JiagonError::InvalidVault
    )]
    pub vault_config: Account<'info, VaultConfig>,
    pub payment_mint: Account<'info, Mint>,
    #[account(mut)]
    pub vault_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = borrower_token_account.mint == payment_mint.key() @ JiagonError::InvalidVault,
        constraint = borrower_token_account.owner == owner.key() @ JiagonError::OwnerMismatch
    )]
    pub borrower_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
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
pub struct CreditLine {
    pub owner: Pubkey,
    pub locked_credit_cents: u64,
    pub repayment_count: u32,
    pub updated_at: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct VaultConfig {
    pub admin: Pubkey,
    pub payment_mint: Pubkey,
    pub vault_token_account: Pubkey,
    pub merchant_escrow_token_account: Pubkey,
    pub vault_authority_bump: u8,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct PurposeDraw {
    pub owner: Pubkey,
    pub draw_id: [u8; 16],
    pub purpose: [u8; 32],
    pub merchant_hash: [u8; 32],
    pub merchant_escrow_token_account: Pubkey,
    pub amount_cents: u64,
    pub token_amount: u64,
    pub status: DrawStatus,
    pub created_at: i64,
    pub expires_at: i64,
    pub repaid_at: i64,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum DrawStatus {
    Active,
    Repaid,
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

#[account]
#[derive(InitSpace)]
pub struct ReceiptGlobalRegistry {
    pub source_receipt_hash: [u8; 32],
    pub owner: Pubkey,
    pub receipt: Pubkey,
    pub created_at: i64,
    pub bump: u8,
}

#[error_code]
pub enum JiagonError {
    #[msg("Admin is not authorized to initialize verifier config.")]
    UnauthorizedAdmin,
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
    #[msg("Credit arithmetic overflowed.")]
    ArithmeticOverflow,
    #[msg("Vault configuration or token account is invalid.")]
    InvalidVault,
    #[msg("Restaurant deposit amount must be greater than zero.")]
    InvalidDrawAmount,
    #[msg("Requested deposit exceeds available credit.")]
    CreditLimitExceeded,
    #[msg("Restaurant deposit expiry must be in the future.")]
    InvalidExpiry,
    #[msg("Purpose draw is not active.")]
    DrawNotActive,
    #[msg("Payment mint must use at least two decimals.")]
    UnsupportedMintDecimals,
}

fn score_for(receipt_count: u32, total_spend_cents: u64) -> Result<u16> {
    let receipt_points = receipt_count
        .checked_mul(28)
        .ok_or(JiagonError::ArithmeticOverflow)?;
    let spend_points = (total_spend_cents / 100).min(44) as u32;
    let score = receipt_points
        .checked_add(spend_points)
        .ok_or(JiagonError::ArithmeticOverflow)?
        .min(100) as u16;

    Ok(score)
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

fn token_amount_for_cents(amount_cents: u64, mint_decimals: u8) -> Result<u64> {
    require!(mint_decimals >= 2, JiagonError::UnsupportedMintDecimals);
    let scale = 10_u64
        .checked_pow(u32::from(mint_decimals - 2))
        .ok_or(JiagonError::ArithmeticOverflow)?;

    let token_amount = amount_cents
        .checked_mul(scale)
        .ok_or(JiagonError::ArithmeticOverflow)?;
    Ok(token_amount)
}
