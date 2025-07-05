use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint,
    entrypoint::ProgramResult,
    msg,
    program_error::ProgramError,
    pubkey::Pubkey,
    rent::Rent,
    system_instruction,
    sysvar::Sysvar,
};

// Define the state stored in accounts
#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct VotingAccount {
    pub is_initialized: bool,
    pub option_a_votes: u64,
    pub option_b_votes: u64,
    pub option_c_votes: u64,
    pub option_d_votes: u64,
}

#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct VoteInstruction {
    pub option: u8, // 0, 1, 2, or 3 for options A, B, C, D
}

// Declare and export the program's entrypoint
entrypoint!(process_instruction);

// Program entrypoint's implementation
pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    let accounts_iter = &mut accounts.iter();
    let account = next_account_info(accounts_iter)?;

    // Check if the account is owned by the program
    if account.owner != program_id {
        msg!("Account does not have the correct program id");
        return Err(ProgramError::IncorrectProgramId);
    }

    // Try to deserialize the account data
    let mut voting_account = if account.data.borrow().len() == 0 {
        // Initialize new voting account
        VotingAccount {
            is_initialized: true,
            option_a_votes: 0,
            option_b_votes: 0,
            option_c_votes: 0,
            option_d_votes: 0,
        }
    } else {
        VotingAccount::try_from_slice(&account.data.borrow())?
    };

    // Process the vote instruction
    if !instruction_data.is_empty() {
        let vote_instruction = VoteInstruction::try_from_slice(instruction_data)?;
        
        match vote_instruction.option {
            0 => voting_account.option_a_votes += 1,
            1 => voting_account.option_b_votes += 1,
            2 => voting_account.option_c_votes += 1,
            3 => voting_account.option_d_votes += 1,
            _ => {
                msg!("Invalid voting option");
                return Err(ProgramError::InvalidInstructionData);
            }
        }

        msg!("Vote cast for option {}", vote_instruction.option);
    }

    // Serialize the updated account data
    voting_account.serialize(&mut &mut account.data.borrow_mut()[..])?;

    Ok(())
}
