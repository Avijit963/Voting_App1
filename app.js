// Use the global solanaWeb3 object from the CDN
const { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } = window.solanaWeb3

// App state
let wallet = null
let connection = null
let votingData = {
  optionA: 0,
  optionB: 0,
  optionC: 0,
  optionD: 0,
}

// Wait for DOM to be fully loaded
document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM loaded, initializing app...")

  // Small delay to ensure all scripts are loaded
  setTimeout(() => {
    initializeApp()
  }, 500)
})

function initializeApp() {
  console.log("Starting app initialization...")

  // Check if Solana Web3.js is loaded
  updateDebugInfo("solanaStatus", window.solanaWeb3 ? "✅ Loaded" : "❌ Not loaded")

  if (!window.solanaWeb3) {
    showToast("Solana Web3.js failed to load. Please refresh the page.", "error")
    return
  }

  // Initialize connection with better RPC endpoint
  try {
    // Try multiple RPC endpoints for better reliability
    const rpcEndpoints = [
      "https://api.devnet.solana.com",
      "https://devnet.helius-rpc.com/?api-key=demo",
      "https://solana-devnet.g.alchemy.com/v2/demo",
    ]

    connection = new window.solanaWeb3.Connection(rpcEndpoints[0], {
      commitment: "confirmed",
      confirmTransactionInitialTimeout: 60000,
    })

    updateDebugInfo("connectionStatus", "✅ Connected to Devnet")
    console.log("Connected to Solana Devnet")

    // Test the connection
    connection
      .getVersion()
      .then((version) => {
        console.log("RPC Version:", version)
        updateDebugInfo("connectionStatus", `✅ Connected (${version["solana-core"]})`)
      })
      .catch((err) => {
        console.error("RPC test failed:", err)
        updateDebugInfo("connectionStatus", "⚠️ Connection unstable")
      })
  } catch (error) {
    console.error("Failed to connect to Solana:", error)
    updateDebugInfo("connectionStatus", "❌ Connection failed")
    showToast("Failed to connect to Solana network", "error")
    return
  }

  // Check for Phantom wallet
  checkPhantomWallet()

  // Set up event listeners
  setupEventListeners()

  // Load voting data
  loadVotingData()

  // Check for existing wallet connection
  checkExistingConnection()

  console.log("App initialization complete")
}

function checkPhantomWallet() {
  if (window.solana && window.solana.isPhantom) {
    updateDebugInfo("phantomStatus", "✅ Phantom detected")
    console.log("Phantom wallet detected")
  } else {
    updateDebugInfo("phantomStatus", "❌ Phantom not found")
    console.log("Phantom wallet not detected")
  }
}

function updateDebugInfo(elementId, message) {
  const element = document.getElementById(elementId)
  if (element) {
    element.textContent = message
  }
}

function setupEventListeners() {
  console.log("Setting up event listeners...")

  // Connect wallet button
  const connectBtn = document.getElementById("connectWallet")
  if (connectBtn) {
    connectBtn.addEventListener("click", connectWallet)
    console.log("Connect wallet button listener added")
  }

  // Vote buttons
  const voteButtons = document.querySelectorAll(".vote-btn")
  console.log(`Found ${voteButtons.length} vote buttons`)

  voteButtons.forEach((btn, index) => {
    btn.addEventListener("click", (e) => {
      const option = Number.parseInt(e.target.dataset.option)
      console.log(`Vote button ${index} clicked for option ${option}`)
      castVote(option)
    })
  })
}

async function connectWallet() {
  console.log("Connect wallet clicked")

  if (!window.solana || !window.solana.isPhantom) {
    showToast("Phantom wallet not found. Please install Phantom wallet.", "error")
    setTimeout(() => {
      window.open("https://phantom.app/", "_blank")
    }, 2000)
    return
  }

  try {
    showLoadingModal(true, "Connecting to wallet...")

    console.log("Requesting wallet connection...")
    const response = await window.solana.connect()

    if (response.publicKey) {
      wallet = response.publicKey
      console.log("Wallet connected:", wallet.toString())

      updateWalletUI()
      await updateWalletBalance()

      showToast("Wallet connected successfully! 🎉")
    } else {
      throw new Error("No public key received")
    }
  } catch (error) {
    console.error("Wallet connection failed:", error)

    if (error.code === 4001) {
      showToast("Wallet connection was rejected by user", "warning")
    } else if (error.message.includes("User rejected")) {
      showToast("Connection cancelled by user", "warning")
    } else {
      showToast("Failed to connect wallet: " + error.message, "error")
    }
  } finally {
    showLoadingModal(false)
  }
}

async function checkExistingConnection() {
  if (window.solana && window.solana.isPhantom) {
    try {
      const response = await window.solana.connect({ onlyIfTrusted: true })
      if (response.publicKey) {
        wallet = response.publicKey
        console.log("Existing wallet connection found:", wallet.toString())
        updateWalletUI()
        await updateWalletBalance()
      }
    } catch (error) {
      console.log("No existing trusted connection")
    }
  }
}

function updateWalletUI() {
  const connectBtn = document.getElementById("connectWallet")
  const walletStatus = document.getElementById("walletStatus")
  const walletAddress = document.getElementById("walletAddress")

  if (wallet && connectBtn && walletStatus && walletAddress) {
    // Update button
    connectBtn.textContent = "✅ Connected"
    connectBtn.classList.add("connected")
    connectBtn.disabled = true

    // Show wallet status
    walletStatus.classList.remove("hidden")
    walletAddress.textContent = `Address: ${wallet.toString().slice(0, 8)}...${wallet.toString().slice(-8)}`

    // Enable vote buttons
    const voteButtons = document.querySelectorAll(".vote-btn")
    voteButtons.forEach((btn) => {
      btn.disabled = false
      btn.textContent = btn.textContent.replace("Vote for", "Vote for")
    })

    console.log("Wallet UI updated")
  }
}

async function updateWalletBalance() {
  if (!wallet || !connection) return

  try {
    const balance = await connection.getBalance(wallet)
    const solBalance = balance / window.solanaWeb3.LAMPORTS_PER_SOL

    const balanceElement = document.getElementById("walletBalance")
    if (balanceElement) {
      balanceElement.textContent = `Balance: ${solBalance.toFixed(4)} SOL`
    }

    console.log("Wallet balance:", solBalance, "SOL")

    if (solBalance < 0.01) {
      showToast("Low balance! Get free Devnet SOL from faucet.solana.com", "warning")
    }
  } catch (error) {
    console.error("Failed to get wallet balance:", error)
  }
}

async function castVote(option) {
  console.log("Casting vote for option:", option)

  if (!wallet) {
    showToast("Please connect your wallet first", "error")
    return
  }

  if (!connection) {
    showToast("No connection to Solana network", "error")
    return
  }

  try {
    showLoadingModal(true, "Creating transaction...")

    // Create a simple memo transaction for voting
    const transaction = new window.solanaWeb3.Transaction()

    // Add memo instruction
    const memoInstruction = new window.solanaWeb3.TransactionInstruction({
      keys: [],
      programId: new window.solanaWeb3.PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"),
      data: Buffer.from(`Vote for option ${option + 1} - ${Date.now()}`, "utf8"),
    })

    transaction.add(memoInstruction)

    // Get latest blockhash (updated method)
    showLoadingModal(true, "Getting latest blockhash...")
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed")
    transaction.recentBlockhash = blockhash
    transaction.feePayer = wallet

    console.log("Transaction created, requesting signature...")

    // Sign transaction
    showLoadingModal(true, "Please approve in wallet...")
    const signedTransaction = await window.solana.signTransaction(transaction)

    // Send transaction
    showLoadingModal(true, "Sending transaction...")
    const signature = await connection.sendRawTransaction(signedTransaction.serialize(), {
      skipPreflight: false,
      preflightCommitment: "confirmed",
    })

    console.log("Transaction sent:", signature)

    // Wait for confirmation using the new method
    showLoadingModal(true, "Confirming transaction...")
    const confirmation = await connection.confirmTransaction(
      {
        signature: signature,
        blockhash: blockhash,
        lastValidBlockHeight: lastValidBlockHeight,
      },
      "confirmed",
    )

    if (confirmation.value.err) {
      throw new Error(`Transaction failed: ${confirmation.value.err}`)
    }

    console.log("Transaction confirmed:", signature)

    // Update vote count
    updateVoteCount(option)
    markCardAsVoted(option)

    showToast(`Vote cast successfully! 🗳️ Transaction: ${signature.slice(0, 8)}...`)
  } catch (error) {
    console.error("Voting failed:", error)

    if (error.message.includes("User rejected")) {
      showToast("Transaction was cancelled", "warning")
    } else if (error.message.includes("insufficient")) {
      showToast("Insufficient SOL balance for transaction", "error")
    } else if (error.message.includes("blockhash")) {
      showToast("Network issue - please try again", "error")
    } else {
      showToast("Failed to cast vote: " + error.message, "error")
    }
  } finally {
    showLoadingModal(false)
  }
}

function updateVoteCount(option) {
  const options = ["optionA", "optionB", "optionC", "optionD"]
  votingData[options[option]]++

  // Save to localStorage
  localStorage.setItem("votingData", JSON.stringify(votingData))

  // Update UI
  updateVotingResults()

  console.log("Vote count updated:", votingData)
}

function markCardAsVoted(option) {
  const card = document.querySelector(`[data-option="${option}"]`)
  const btn = card.querySelector(".vote-btn")

  if (card && btn) {
    card.classList.add("voted")
    btn.classList.add("voted")
    btn.textContent = "✅ Voted"
    btn.disabled = true
  }
}

function loadVotingData() {
  const saved = localStorage.getItem("votingData")
  if (saved) {
    votingData = JSON.parse(saved)
    console.log("Loaded voting data:", votingData)
  } else {
    // Initialize with sample data
    votingData = {
      optionA: Math.floor(Math.random() * 50) + 10,
      optionB: Math.floor(Math.random() * 50) + 10,
      optionC: Math.floor(Math.random() * 50) + 10,
      optionD: Math.floor(Math.random() * 50) + 10,
    }
    localStorage.setItem("votingData", JSON.stringify(votingData))
    console.log("Initialized voting data:", votingData)
  }

  updateVotingResults()
}

function updateVotingResults() {
  const total = votingData.optionA + votingData.optionB + votingData.optionC + votingData.optionD

  const options = [
    { key: "optionA", id: "A" },
    { key: "optionB", id: "B" },
    { key: "optionC", id: "C" },
    { key: "optionD", id: "D" },
  ]

  options.forEach((option) => {
    const count = votingData[option.key]
    const percentage = total > 0 ? (count / total) * 100 : 0

    const countElement = document.getElementById(`option${option.id}Count`)
    const progressElement = document.getElementById(`option${option.id}Progress`)
    const percentElement = document.getElementById(`option${option.id}Percent`)

    if (countElement) countElement.textContent = `${count} votes`
    if (progressElement) progressElement.style.width = `${percentage}%`
    if (percentElement) percentElement.textContent = `${percentage.toFixed(1)}%`
  })
}

function showLoadingModal(show, text = "Processing...") {
  const modal = document.getElementById("loadingModal")
  const loadingText = document.getElementById("loadingText")

  if (modal) {
    if (show) {
      modal.classList.remove("hidden")
      if (loadingText) loadingText.textContent = text
    } else {
      modal.classList.add("hidden")
    }
  }
}

function showToast(message, type = "success") {
  console.log("Toast:", type, message)

  const container = document.getElementById("toastContainer")
  if (!container) return

  const toast = document.createElement("div")
  toast.className = `toast ${type}`
  toast.textContent = message

  container.appendChild(toast)

  // Remove toast after 4 seconds
  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast)
    }
  }, 4000)
}

// Simulate periodic vote updates for demo
setInterval(() => {
  if (Math.random() < 0.05) {
    // 5% chance every 10 seconds
    const randomOption = Math.floor(Math.random() * 4)
    const options = ["optionA", "optionB", "optionC", "optionD"]
    votingData[options[randomOption]]++
    localStorage.setItem("votingData", JSON.stringify(votingData))
    updateVotingResults()
  }
}, 10000)
