// ── Network Config ─────────────────────────────────────────
const ARC_CHAIN_ID  = 5042002;
const ARC_CHAIN_HEX = "0x" + ARC_CHAIN_ID.toString(16);
const ARC_RPC       = "https://5042002.rpc.thirdweb.com";

// ⚠️  Paste your NEW contract address here after redeploying PigSave.sol
const CONTRACT_ADDRESS = "0x23A698adB00f7807E48a8df772535493707dE720";

const PIGSAVE_ABI = [
  "function buyPig(uint8 mode, uint256 goalAmount) external payable",
  "function deposit() external payable",
  "function withdraw() external",
  "function getUserData(address addr) external view returns (uint256 balance, uint256 depositCount, uint8 mode, uint256 goalAmount, bool hasPig)"
];

// ── App State ──────────────────────────────────────────────
let provider, signer, userAddress;
let pigSaveContract;
let currentLang  = "en";
let selectedMode = "normal"; // chosen on the buy screen

const LANG_CYCLE  = ["en", "vi", "zh"];
const LANG_LABELS = { en: "EN", vi: "VI", zh: "CN" };

let userData = {
  balance:      0n,
  depositCount: 0n,
  mode:         0,   // 1 = Normal, 2 = With Goal
  goalAmount:   0n,
  hasPig:       false
};

// ── Rank System ────────────────────────────────────────────
// Diamond fills 9-cell area at ×1.4; Piglet base = ~164 px
function getRank(balanceUSD) {
  if (balanceUSD >= 1000) return { cls: "rank-diamond-pig", label: "Diamond Pig", scale: 1.2, prefix: "c" };
  if (balanceUSD >= 100)  return { cls: "rank-golden-pig",  label: "Golden Pig",  scale: 1.1, prefix: "b" };
  return                         { cls: "rank-piglet",      label: "Piglet",      scale: 1.0, prefix: "a" };
}

// ── Translations ───────────────────────────────────────────
const T = {
  vi: {
    noGoalInput:    "Nhập số tiền mục tiêu trước nhé!",
    buying:         "Đang mua heo...",
    buyOk:          "Có heo rồi! Bắt đầu tiết kiệm thôi",
    depositing:     "Đang bỏ heo...",
    withdrawing:    "Đang đập heo...",
    depositOk:      (n) => `Bỏ heo lần ${n}!`,
    rankUp:         (r) => `Lên cấp: ${r}!`,
    withdrawOk:     "Đập heo thành công! Tiền về ví rồi!",
    txFailed:       "Giao dịch thất bại",
    noBalance:      "Heo đang rỗng, bỏ tiền vào trước nhé!",
    noMeta:         "Cài MetaMask để tiếp tục!",
    connectFail:    "Kết nối thất bại",
    needNetwork:    "Đang chuyển sang Arc Testnet...",
    // Normal mode early break
    earlyTitle:     "Heo chưa đủ no...",
    earlyBody:      "Bạn chưa bỏ heo đủ 30 lần.\nNếu đập sớm, 1 USDC mua heo sẽ không được hoàn lại. Hãy kiên trì thêm nhé!",
    earlyCount:     (done, left) => `${done} / 30 lần — còn ${left} lần nữa`,
    // Purpose mode early break
    goalEarlyTitle: "Chưa đến đích rồi...",
    goalEarlyBody:  "Bạn chưa đạt mục tiêu tiết kiệm.\nNếu đập sớm, 1 USDC mua heo sẽ không được hoàn lại. Hãy kiên trì thêm nhé!",
    goalEarlyCount: (pct) => `Hiện tại mới được ${pct}%`,
    // 30/30 success
    successTitle:   "Bạn đã làm được rồi!",
    successBody:    "Bỏ heo đủ 30 lần — bạn đã giữ kỷ luật tài chính trong ít nhất một tháng.\n1 USDC mua heo sẽ được hoàn trả cùng toàn bộ số tiền đã để dành.",
    successCount:   (n) => `Tổng cộng ${n} lần bỏ heo`,
    // Purpose mode success
    goalSuccessTitle: "Mục tiêu đạt được!",
    goalSuccessBody:  "Bạn đã tiết kiệm đủ số tiền mục tiêu!\n1 USDC mua heo sẽ được hoàn trả cùng toàn bộ số tiền đã để dành.",
    goalSuccessCount: (pct) => `Đã đạt ${pct}% mục tiêu`,
  },
  en: {
    noGoalInput:    "Please enter your saving goal first!",
    buying:         "Buying your pig...",
    buyOk:          "Pig acquired! Start saving",
    depositing:     "Saving to piggy...",
    withdrawing:    "Breaking piggy bank...",
    depositOk:      (n) => `Save #${n} done!`,
    rankUp:         (r) => `Rank up: ${r}!`,
    withdrawOk:     "Piggy broken! Funds returned to wallet!",
    txFailed:       "Transaction failed",
    noBalance:      "Piggy is empty — deposit first!",
    noMeta:         "Please install MetaMask!",
    connectFail:    "Connection failed",
    needNetwork:    "Switching to Arc Testnet...",
    earlyTitle:     "Your piggy isn't full yet...",
    earlyBody:      "You haven't saved 30 times yet.\nBreaking early means you won't get your 1 USDC pig fee back. Stay strong!",
    earlyCount:     (done, left) => `${done} / 30 saves — ${left} more to go`,
    goalEarlyTitle: "Not at your goal yet...",
    goalEarlyBody:  "You haven't reached your saving goal yet.\nBreaking early means you won't get your 1 USDC pig fee back. Stay strong!",
    goalEarlyCount: (pct) => `Current progress: ${pct}%`,
    successTitle:   "You earned it!",
    successBody:    "30 saves complete — you stayed disciplined for at least a month.\nYour 1 USDC pig fee will be refunded together with all your savings.",
    successCount:   (n) => `Total saves: ${n}`,
    goalSuccessTitle: "Goal reached!",
    goalSuccessBody:  "You hit your saving target!\nYour 1 USDC pig fee will be refunded together with all your savings.",
    goalSuccessCount: (pct) => `Reached ${pct}% of goal`,
  },
  zh: {
    noGoalInput:    "请先输入目标金额！",
    buying:         "购买小猪中...",
    buyOk:          "小猪到手！开始存钱吧",
    depositing:     "正在存钱...",
    withdrawing:    "正在打碎存钱罐...",
    depositOk:      (n) => `第 ${n} 次存钱成功！`,
    rankUp:         (r) => `升级了：${r}！`,
    withdrawOk:     "存钱罐已打碎！资金已返回钱包！",
    txFailed:       "交易失败",
    noBalance:      "存钱罐是空的，先存点钱吧！",
    noMeta:         "请先安装 MetaMask！",
    connectFail:    "连接失败",
    needNetwork:    "正在切换到 Arc 测试网...",
    earlyTitle:     "小猪还没吃饱...",
    earlyBody:      "你还没存30次。\n提前打碎将无法退回1 USDC购买费。再坚持一下！",
    earlyCount:     (done, left) => `${done} / 30 次 — 还差 ${left} 次`,
    goalEarlyTitle: "还没到终点...",
    goalEarlyBody:  "你还没达到存钱目标。\n提前打碎将无法退回1 USDC购买费。再坚持一下！",
    goalEarlyCount: (pct) => `目前进度 ${pct}%`,
    successTitle:   "你做到了！",
    successBody:    "存满30次——你坚持了至少一个月的财务纪律。\n1 USDC购买费将连同全部存款一起退还。",
    successCount:   (n) => `共存钱 ${n} 次`,
    goalSuccessTitle: "目标达成！",
    goalSuccessBody:  "你已达到存钱目标！\n1 USDC购买费将连同全部存款一起退还。",
    goalSuccessCount: (pct) => `已达成目标的 ${pct}%`,
  }
};

function t(key, ...args) {
  const val = T[currentLang][key];
  return typeof val === "function" ? val(...args) : val;
}

// ── Language ───────────────────────────────────────────────
function toggleLangMenu() {
  document.querySelectorAll(".lang-selector").forEach(s => s.classList.toggle("open"));
}

function pickLang(lang) {
  // close all menus
  document.querySelectorAll(".lang-selector").forEach(s => s.classList.remove("open"));
  setLang(lang);
}

function setLang(lang) {
  currentLang = lang;
  // update pill label
  document.querySelectorAll(".lang-pill").forEach(btn => {
    btn.textContent = LANG_LABELS[lang];
  });
  // update active option highlight in all dropdowns
  document.querySelectorAll(".lang-option").forEach(opt => {
    opt.classList.toggle("active", opt.getAttribute("onclick") === `pickLang('${lang}')`);
  });
  applyLang();
}

// close dropdowns when clicking outside
document.addEventListener("click", e => {
  if (!e.target.closest(".lang-selector")) {
    document.querySelectorAll(".lang-selector").forEach(s => s.classList.remove("open"));
  }
  if (!e.target.closest(".b-menu-wrap")) {
    document.querySelectorAll(".b-menu-dropdown").forEach(d => d.classList.add("hidden"));
  }
});

// ── Buy screen menu ────────────────────────────────────────
function toggleBuyMenu() {
  document.getElementById("buyMenuDropdown").classList.toggle("hidden");
}

function toggleAppMenu() {
  document.getElementById("appMenuDropdown").classList.toggle("hidden");
}

// ── Info panel content ─────────────────────────────────────
const INFO_PANELS = {
  about: {
    en: {
      title: "About PigSave",
      body: `<p>If blockchain becomes part of everyday life, everyday financial habits might also need an on-chain version.</p>
<p>PigSave was built around an idea: a piggy bank for on-chain income — from salary and yield to small daily payments.</p>
<p><strong>How it works</strong></p>
<p>Mint a pig with 1 USDC (a refundable deposit, not a fee), then choose:<br>– Normal Mode: save 30 times and get your 1 USDC back.<br>– Goal Mode: reach your saving goal and get your 1 USDC back.</p>
<p>The 1 USDC acts as a commitment mechanism to encourage discipline and prevent breaking the pig too early.</p>
<p>Funds are held in a smart contract, not by any third party.</p>
<p>Break the pig at any time to withdraw savings, and get your 1 USDC back if you meet the conditions.</p>
<p><em>Future idea: funds inside the pig could be used for safe yield farming, though risks need to be carefully weighed.</em></p>`
    },
    vi: {
      title: "PigSave: Heo đất on-Arc",
      body: `<p>Nếu blockchain trở thành một phần của cuộc sống hàng ngày, các thói quen tài chính hàng ngày cũng có thể cần phiên bản trên chuỗi.</p>
<p>PigSave sinh ra vì ý tưởng: một heo đất cho thu nhập trên chuỗi, từ lương và lợi suất đến các khoản thanh toán nhỏ hàng ngày.</p>
<p><strong>Cách thức hoạt động</strong></p>
<p>Đúc một con heo với 1 USDC (một khoản đặt cọc có thể hoàn lại, không phải phí), sau đó chọn:<br>– Chế độ Thường: tiết kiệm 30 lần và nhận lại 1 USDC.<br>– Chế độ Mục tiêu: đạt được mục tiêu tiết kiệm và nhận lại 1 USDC.</p>
<p>1 USDC đóng vai trò như một cơ chế cam kết để khuyến khích kỷ luật và ngăn chặn việc đập heo quá sớm.</p>
<p>Quỹ được giữ trong hợp đồng thông minh, không phải bởi bất kỳ bên thứ ba nào.</p>
<p>Đập heo bất cứ lúc nào để rút tiết kiệm, và nhận lại 1 USDC nếu đáp ứng điều kiện.</p>
<p><em>Ý tưởng tương lai: quỹ trong heo có thể được sử dụng cho việc canh tác lợi suất an toàn, mặc dù rủi ro cần được cân nhắc kỹ lưỡng.</em></p>`
    },
    zh: {
      title: "关于 PigSave",
      body: `<p>如果区块链成为日常生活的一部分，日常财务习惯也可能需要一个链上版本。</p>
<p>PigSave 源于一个想法：为链上收入打造一个存钱罐——从薪资和收益到日常小额支付。</p>
<p><strong>使用方式</strong></p>
<p>用 1 USDC 铸造一只小猪（可退还的押金，非手续费），然后选择：<br>– 普通模式：存满 30 次，取回 1 USDC。<br>– 目标模式：达成存钱目标，取回 1 USDC。</p>
<p>1 USDC 作为承诺机制，鼓励自律，防止过早打碎存钱罐。</p>
<p>资金由智能合约持有，不经任何第三方。</p>
<p>随时打碎存钱罐以提取存款，满足条件即可取回 1 USDC。</p>
<p><em>未来设想：存钱罐内的资金可用于安全的收益耕作，但风险需仔细权衡。</em></p>`
    }
  },
  security: {
    en: {
      title: "Trust & Security",
      body: `<p>Your funds are held in a smart contract — not by PigSave or any third party.</p>
<p>The contract is simple, minimal, and open source. Only you — the wallet that bought the pig — can withdraw the funds.</p>
<p>Source code: <a href="https://github.com/KattyFury/pigsave" target="_blank" rel="noopener">github.com/KattyFury/pigsave</a></p>
<p>Contract on Arc Testnet:<br><code>0x23A698adB00f7807E48a8df772535493707dE720</code></p>
<p>PigSave has no access to your funds and cannot stop your withdrawal.</p>
<p><em>Note: Currently running on Arc Testnet. Do not use real funds.</em></p>`
    },
    vi: {
      title: "An toàn & Bảo mật",
      body: `<p>Tiền của bạn được giữ trong hợp đồng thông minh — không phải bởi PigSave hay bất kỳ bên thứ ba nào.</p>
<p>Hợp đồng được thiết kế đơn giản, tối thiểu và mã nguồn mở. Chỉ bạn — ví đã mua heo — mới có thể rút tiền.</p>
<p>Mã nguồn: <a href="https://github.com/KattyFury/pigsave" target="_blank" rel="noopener">github.com/KattyFury/pigsave</a></p>
<p>Địa chỉ hợp đồng trên Arc Testnet:<br><code>0x23A698adB00f7807E48a8df772535493707dE720</code></p>
<p>PigSave không có quyền truy cập vào tiền của bạn và không thể dừng giao dịch rút của bạn.</p>
<p><em>Lưu ý: Hiện đang chạy trên Arc Testnet. Không dùng tiền thật.</em></p>`
    },
    zh: {
      title: "信任与安全",
      body: `<p>您的资金由智能合约持有——不经 PigSave 或任何第三方。</p>
<p>合约设计简洁、最小化且开源。只有您——购买小猪的钱包——才能提取资金。</p>
<p>源代码：<a href="https://github.com/KattyFury/pigsave" target="_blank" rel="noopener">github.com/KattyFury/pigsave</a></p>
<p>Arc 测试网合约地址：<br><code>0x23A698adB00f7807E48a8df772535493707dE720</code></p>
<p>PigSave 无法访问您的资金，也无法阻止您的提款。</p>
<p><em>注意：目前运行在 Arc 测试网上，请勿使用真实资金。</em></p>`
    }
  }
};

function menuAction(key) {
  document.querySelectorAll(".b-menu-dropdown").forEach(d => d.classList.add("hidden"));
  openInfoPanel(key);
}

async function openInfoPanel(key) {
  const panel   = document.getElementById("infoPanel");
  const titleEl = document.getElementById("infoPanelTitle");
  const bodyEl  = document.getElementById("infoPanelContent");

  if (key === "history") {
    const titles = { en: "Deposit History", vi: "Lịch sử giao dịch", zh: "存款记录" };
    titleEl.textContent = titles[currentLang] || titles.en;
    bodyEl.innerHTML    = "";
    panel.classList.remove("hidden");
    await loadDepositHistory(bodyEl);
  } else {
    const info = (INFO_PANELS[key] || {})[currentLang] || (INFO_PANELS[key] || {}).en;
    if (!info) return;
    titleEl.textContent = info.title;
    bodyEl.innerHTML    = info.body;
    panel.classList.remove("hidden");
  }
}

function closeInfoPanel() {
  document.getElementById("infoPanel").classList.add("hidden");
}

function handleInfoPanelClick(e) {
  if (!e.target.closest(".info-panel-box")) closeInfoPanel();
}

async function loadDepositHistory(el) {
  const L = {
    loading:    { en: "Loading history…",             vi: "Đang tải lịch sử…",          zh: "加载中…" },
    empty:      { en: "No deposits found.",            vi: "Chưa có giao dịch nào.",      zh: "暂无存款记录。" },
    viewOnScan: { en: "View full history on Arc Scan", vi: "Xem lịch sử trên Arc Scan",   zh: "在 Arc Scan 查看记录" }
  };
  const lang = currentLang;
  const g    = k => L[k][lang] || L[k].en;

  el.innerHTML = `<p class="history-loading">${g("loading")}</p>`;

  if (!userAddress) {
    el.innerHTML = `<p class="history-empty">${g("empty")}</p>`;
    return;
  }

  try {
    const apiUrl = `https://testnet.arcscan.app/api?module=account&action=txlist&address=${userAddress}&sort=desc&page=1&offset=50`;
    const ctrl   = new AbortController();
    const tid    = setTimeout(() => ctrl.abort(), 8000);
    const res    = await fetch(apiUrl, { signal: ctrl.signal });
    clearTimeout(tid);
    const data = await res.json();

    if (data.status !== "1" || !Array.isArray(data.result)) throw new Error("bad");

    const txs = data.result.filter(tx =>
      tx.to?.toLowerCase() === CONTRACT_ADDRESS.toLowerCase() &&
      tx.isError === "0" &&
      BigInt(tx.value || "0") > 0n
    );

    if (txs.length === 0) {
      el.innerHTML = `<p class="history-empty">${g("empty")}</p>`;
      return;
    }

    const rows = txs.map(tx => {
      const ts     = new Date(parseInt(tx.timeStamp) * 1000);
      const date   = ts.toLocaleDateString(undefined, { month: "short", day: "numeric" });
      const time   = ts.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
      const amount = parseFloat(ethers.formatUnits(tx.value, 18)).toFixed(2);
      const url    = `https://testnet.arcscan.app/tx/${tx.hash}`;
      const hash   = tx.hash.slice(0, 8) + "…";
      return `<div class="history-item">
        <div>
          <div class="history-amount">+${amount} USDC</div>
          <div class="history-date">${date} ${time}</div>
        </div>
        <a class="history-tx" href="${url}" target="_blank" rel="noopener">${hash}</a>
      </div>`;
    }).join("");

    const scanUrl = `https://testnet.arcscan.app/address/${userAddress}`;
    el.innerHTML  = `<div class="history-list">${rows}</div>
      <p class="history-footer"><a class="history-link" href="${scanUrl}" target="_blank" rel="noopener">${g("viewOnScan")} ↗</a></p>`;

  } catch {
    const scanUrl = `https://testnet.arcscan.app/address/${userAddress}`;
    el.innerHTML  = `<p class="history-fallback"><a class="history-link" href="${scanUrl}" target="_blank" rel="noopener">${g("viewOnScan")} ↗</a></p>`;
  }
}

function applyLang() {
  document.querySelectorAll("[data-vi]").forEach(el => {
    el.innerHTML = el.getAttribute(`data-${currentLang}`) ?? el.getAttribute("data-en");
  });
  if (userData.hasPig) updateStats();
}

// ── Screen management ──────────────────────────────────────
function showScreen(id) {
  ["connectSection", "buySection", "appSection"].forEach(s =>
    document.getElementById(s).classList.toggle("hidden", s !== id)
  );
}

// ── Mode selection (on buy screen) ────────────────────────
const MODE_DESC = {
  normal:  { vi: "Bỏ heo ít nhất 30 lần và lấy lại 1 USDC",
             en: "Save at least 30 times and get your 1 USDC back",
             zh: "至少存30次，即可退回1 USDC" },
  purpose: { vi: "Đạt mục tiêu tiết kiệm và lấy lại 1 USDC",
             en: "Reach your saving goal and get your 1 USDC back",
             zh: "达成目标，即可退回1 USDC" }
};

function selectMode(mode) {
  selectedMode = mode;
  document.getElementById("selectNormal").classList.toggle("active",  mode === "normal");
  document.getElementById("selectPurpose").classList.toggle("active", mode === "purpose");
  document.getElementById("goalInputWrap").classList.toggle("hidden", mode !== "purpose");

  // Swap desc text in-place — no element appears/disappears, no layout jump
  const desc = document.getElementById("modeDesc");
  const texts = MODE_DESC[mode];
  desc.setAttribute("data-vi", texts.vi);
  desc.setAttribute("data-en", texts.en);
  desc.setAttribute("data-zh", texts.zh);
  desc.textContent = texts[currentLang] ?? texts.en;
}

// ── Wallet connection ──────────────────────────────────────
async function connectWallet() {
  if (!window.ethereum) { showToast(t("noMeta")); return; }
  try {
    await window.ethereum.request({ method: "eth_requestAccounts" });
    await initApp();
  } catch (err) {
    console.error(err);
    showToast(t("connectFail"));
  }
}

async function initApp() {
  provider        = new ethers.BrowserProvider(window.ethereum);
  signer          = await provider.getSigner();
  userAddress     = await signer.getAddress();
  pigSaveContract = new ethers.Contract(CONTRACT_ADDRESS, PIGSAVE_ABI, signer);

  const addrShort = userAddress.slice(0,6) + "..." + userAddress.slice(-4);
  document.getElementById("walletAddr").textContent    = addrShort;
  document.getElementById("buyWalletAddr").textContent = addrShort;

  // Fetch native balance (USDC on Arc) for buy + app screen display
  await refreshWalletBalance();

  // Check/switch network
  const chainId = await window.ethereum.request({ method: "eth_chainId" });
  if (parseInt(chainId, 16) !== ARC_CHAIN_ID) {
    showToast(t("needNetwork"));
    await switchToArc();
  }

  await refreshData();
}

async function refreshWalletBalance() {
  try {
    const rawBal = await provider.getBalance(userAddress);
    const usdcBal = parseFloat(ethers.formatUnits(rawBal, 18)).toFixed(2);
    const label = usdcBal + " USDC";
    document.querySelectorAll("#buyWalletBalance, #appWalletBalance")
      .forEach(el => { if (el) el.textContent = label; });
  } catch (_) {}
}

async function switchToArc() {
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: ARC_CHAIN_HEX }],
    });
  } catch {
    await window.ethereum.request({
      method: "wallet_addEthereumChain",
      params: [{
        chainId:            ARC_CHAIN_HEX,
        chainName:          "Arc Testnet",
        nativeCurrency:     { name: "USDC", symbol: "USDC", decimals: 18 },
        rpcUrls:            [ARC_RPC],
        blockExplorerUrls:  ["https://testnet.arcscan.app"],
      }],
    });
  }
}

async function disconnectWallet() {
  try {
    await window.ethereum.request({
      method: "wallet_revokePermissions",
      params: [{ eth_accounts: {} }],
    });
  } catch (_) {}
  provider = null; signer = null; userAddress = null; pigSaveContract = null;
  userData = { balance: 0n, depositCount: 0n, mode: 0, goalAmount: 0n, hasPig: false };
  showScreen("connectSection");
}

// ── Data refresh ───────────────────────────────────────────
// skipPigReset = true when called mid-animation (deposit flow)
async function refreshData(skipPigReset = false) {
  try {
    const [bal, cnt, mode, goal, hasPig] = await pigSaveContract.getUserData(userAddress);
    userData = { balance: bal, depositCount: cnt, mode: Number(mode), goalAmount: goal, hasPig };

    if (!hasPig) {
      showScreen("buySection");
      return;
    }

    showScreen("appSection");

    // Show the correct progress bar based on locked mode
    const isNormal = userData.mode === 1;
    document.getElementById("normalProgress").classList.toggle("hidden",  !isNormal);
    document.getElementById("purposeProgress").classList.toggle("hidden",  isNormal);

    updateStats();
    await refreshWalletBalance();

    if (!skipPigReset) {
      // Grow pig smoothly from scale 0 when first landing on app screen
      document.getElementById("pigScale").style.transform = "scale(0)";
      requestAnimationFrame(() => setPigVisual("normal"));
    }
  } catch (err) {
    console.error("refreshData error:", err);
  }
}

function updateStats() {
  if (!userData.hasPig) return;

  const count  = Number(userData.depositCount);
  const balUSD = Number(ethers.formatUnits(userData.balance, 18));
  const rank   = getRank(balUSD);

  // Deposit count (always shown, keeps climbing)
  document.getElementById("depositCount").textContent = count;

  // Rank badge
  const badge = document.getElementById("rankBadge");
  badge.textContent = rank.label;
  badge.className   = "a-rank " + rank.cls;

  // Progress bars
  let done = false;
  if (userData.mode === 1) {
    // Normal: always show bar; bright orange + label "30 / 30" when complete
    done = count >= 30;
    const pct  = Math.min((count / 30) * 100, 100);
    document.getElementById("progressFill").style.width  = pct + "%";
    document.getElementById("progressLabel").textContent = `${count} / 30`;
    document.getElementById("progressFill").classList.toggle("complete", done);
  } else {
    // Purpose: how close to goal
    const goalUSD = Number(ethers.formatUnits(userData.goalAmount, 18));
    const pct     = goalUSD > 0 ? Math.min((balUSD / goalUSD) * 100, 100) : 0;
    done = pct >= 100;
    document.getElementById("goalFill").style.width = pct.toFixed(1) + "%";
    document.getElementById("goalFill").classList.toggle("complete", done);
    document.getElementById("goalPct").textContent  =
      pct.toFixed(0) + "% of $" + goalUSD.toLocaleString();
  }

  // Break button glows when condition is met
  document.querySelector(".btn-break.a-break").classList.toggle("complete", done);
}

// ── Pig visuals ────────────────────────────────────────────
// pigScale div  → rank-based scale (layout unchanged, visually larger)
// pigImg        → image swap + bounce animation
function setPigVisual(state = "normal") {
  const pigScale = document.getElementById("pigScale");
  const pig      = document.getElementById("pigImg");
  const balUSD   = Number(ethers.formatUnits(userData.balance, 18));
  const rank     = getRank(balUSD);

  pigScale.style.transform = `scale(${rank.scale})`;

  const stateNum = { normal: 1, sad: 2, happy: 3, deposit: 4 };
  pig.src = `images/${rank.prefix}${stateNum[state] ?? 1}.png`;
}

function bouncePig() {
  const pig = document.getElementById("pigImg");
  pig.classList.remove("bounce");
  void pig.offsetWidth; // force reflow
  pig.classList.add("bounce");
  pig.addEventListener("animationend", () => pig.classList.remove("bounce"), { once: true });
}

// ── Buy Pig ────────────────────────────────────────────────
async function buyPigAction() {
  if (!signer) return;

  const mode = (selectedMode === "normal") ? 1 : 2;
  let goalAmount = 0n;

  if (mode === 2) {
    const goalVal = parseFloat(document.getElementById("goalInput").value);
    if (!goalVal || goalVal <= 0) { showToast(t("noGoalInput")); return; }
    goalAmount = ethers.parseUnits(goalVal.toString(), 18);
  }

  setBusy(true);
  try {
    showToast(t("buying"));
    const pigPrice = ethers.parseUnits("1", 18); // 1 USDC
    const tx = await pigSaveContract.buyPig(mode, goalAmount, { value: pigPrice });
    await tx.wait();
    showToast(t("buyOk"));
    await refreshData(); // will switch to appSection
  } catch (err) {
    console.error(err);
    showToast(t("txFailed"));
  } finally {
    setBusy(false);
  }
}

// ── Deposit ────────────────────────────────────────────────
async function deposit(usdcAmount) {
  if (!signer) return;

  const prevBalUSD = Number(ethers.formatUnits(userData.balance, 18));
  const prevRank   = getRank(prevBalUSD).label;
  const amount     = ethers.parseUnits(usdcAmount.toString(), 18);

  setBusy(true);
  try {
    showStatus(t("depositing"));
    setPigVisual("deposit");          // step 1: deposit animation

    const tx = await pigSaveContract.deposit({ value: amount });
    await tx.wait();

    // skipPigReset=true so refreshData doesn't clobber our animation
    await refreshData(true);

    bouncePig();
    setPigVisual("happy");            // step 2: happy after tx confirmed

    const newBalUSD = Number(ethers.formatUnits(userData.balance, 18));
    const newRank   = getRank(newBalUSD).label;
    const newCount  = Number(userData.depositCount);

    if (newRank !== prevRank) {
      setTimeout(() => showStatus(t("rankUp", newRank)), 1200);
    } else {
      showStatus(t("depositOk", newCount));
    }

    setTimeout(() => setPigVisual("normal"), 2200); // step 3: back to normal
  } catch (err) {
    console.error(err);
    showStatus(t("txFailed"));
    setPigVisual("normal");
  } finally {
    setBusy(false);
  }
}

// ── Withdraw ───────────────────────────────────────────────
function showModal(isSuccess) {
  const modal = document.getElementById("modal");
  modal.classList.remove("hidden");
  modal.classList.toggle("success", isSuccess);
}

function tryWithdraw() {
  if (userData.balance === 0n) { showStatus(t("noBalance")); return; }

  if (userData.mode === 1) {
    // Normal mode
    const count = Number(userData.depositCount);
    if (count >= 30) {
      // Success: pig is happy, congrats modal
      setPigVisual("happy");
      document.getElementById("modalTitle").textContent = t("successTitle");
      document.getElementById("modalBody").textContent  = t("successBody");
      document.getElementById("modalCount").textContent = t("successCount", count);
      showModal(true);
    } else {
      // Early break: pig is sad, warning modal
      const left = 30 - count;
      setPigVisual("sad");
      document.getElementById("modalTitle").textContent = t("earlyTitle");
      document.getElementById("modalBody").textContent  = t("earlyBody");
      document.getElementById("modalCount").textContent = t("earlyCount", count, left);
      showModal(false);
    }
  } else {
    // With Goal mode
    const balUSD  = Number(ethers.formatUnits(userData.balance, 18));
    const goalUSD = Number(ethers.formatUnits(userData.goalAmount, 18));
    const pct     = goalUSD > 0 ? Math.floor((balUSD / goalUSD) * 100) : 100;
    if (pct >= 100) {
      // Goal reached: happy pig, congrats
      setPigVisual("happy");
      document.getElementById("modalTitle").textContent = t("goalSuccessTitle");
      document.getElementById("modalBody").textContent  = t("goalSuccessBody");
      document.getElementById("modalCount").textContent = t("goalSuccessCount", pct);
      showModal(true);
    } else {
      // Early break: sad pig, warning
      setPigVisual("sad");
      document.getElementById("modalTitle").textContent = t("goalEarlyTitle");
      document.getElementById("modalBody").textContent  = t("goalEarlyBody");
      document.getElementById("modalCount").textContent = t("goalEarlyCount", pct);
      showModal(false);
    }
  }
}

function closeModal() {
  const modal = document.getElementById("modal");
  const isSuccess = modal.classList.contains("success");
  modal.classList.add("hidden");
  modal.classList.remove("success");
  // Only reset pig to normal if we're closing a warning (early break)
  // For success, keep pig happy until user navigates away
  if (!isSuccess) setPigVisual("normal");
}

async function confirmWithdraw() {
  // Close overlay only — do NOT reset pig visual.
  // Pig stays sad (early break) or happy (success) through the whole tx.
  const modal = document.getElementById("modal");
  modal.classList.add("hidden");
  modal.classList.remove("success");
  await executeWithdraw();
}

async function executeWithdraw() {
  setBusy(true);
  try {
    showStatus(t("withdrawing"));
    const tx = await pigSaveContract.withdraw();
    await tx.wait();

    // Show success notification while still on app screen, then transition
    userData = { balance: 0n, depositCount: 0n, mode: 0, goalAmount: 0n, hasPig: false };
    showStatus(t("withdrawOk"));
    setTimeout(() => {
      showScreen("buySection");
      selectMode("normal");
      document.getElementById("goalInput").value = "";
    }, 1800);
  } catch (err) {
    console.error(err);
    showStatus(t("txFailed"));
    setPigVisual("normal");
  } finally {
    setBusy(false);
  }
}

// ── UI helpers ─────────────────────────────────────────────
function setBusy(on) {
  document.querySelectorAll(
    ".btn-deposit, .btn-break, .btn-break-modal, .btn-keep, .c-btn, .b-buy-btn"
  ).forEach(b => b.disabled = on);
}

let toastTimer;
function showToast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add("hidden"), 3200);
}

// Status line shown below "Saved N times" on the app screen
let statusTimer;
function showStatus(msg) {
  const el = document.getElementById("appStatus");
  if (!el) { showToast(msg); return; }
  el.textContent = msg;
  el.classList.add("visible");
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => el.classList.remove("visible"), 3200);
}

// ── MetaMask event listeners ───────────────────────────────
if (window.ethereum) {
  window.ethereum.on("accountsChanged", () => location.reload());
  window.ethereum.on("chainChanged",    () => location.reload());
}

// ── On page load: apply language + auto-reconnect ─────────
document.addEventListener("DOMContentLoaded", async () => {
  // Preload all 12 pig images so every state transition is instant (no flicker)
  ['a','b','c'].forEach(p => [1,2,3,4].forEach(s => { new Image().src = `images/${p}${s}.png`; }));

  setLang("en");
  if (window.ethereum) {
    const accounts = await window.ethereum.request({ method: "eth_accounts" });
    if (accounts.length > 0) await initApp();
  }
});
