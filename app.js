let listeningData = {};
let currentDayKey = "";
let userAnswers = JSON.parse(localStorage.getItem("jlpt_listening_answers") || "{}");
let isSubmitted = false;
let isEditMode = false;
let activeQuestionId = null;
const playbackRates = [1.0, 1.25, 0.8];
let rateIndex = 0;

// DOM Elements
const dayTabsEl = document.getElementById("dayTabs");
const currentDayTitleEl = document.getElementById("currentDayTitle");
const progressTextEl = document.getElementById("progressText");
const questionListEl = document.getElementById("questionList");
const resultBannerEl = document.getElementById("resultBanner");

const audioPlayer = document.getElementById("audioPlayer");
const playPauseBtn = document.getElementById("playPauseBtn");
const rewindBtn = document.getElementById("rewindBtn");
const forwardBtn = document.getElementById("forwardBtn");
const seekBar = document.getElementById("seekBar");
const currentTimeLabel = document.getElementById("currentTimeLabel");
const durationLabel = document.getElementById("durationLabel");
const speedBtn = document.getElementById("speedBtn");

const submitBtn = document.getElementById("submitBtn");
const resetBtn = document.getElementById("resetBtn");
const toggleEditModeBtn = document.getElementById("toggleEditModeBtn");
const exportJsonBtn = document.getElementById("exportJsonBtn");

// Khởi chạy ứng dụng
async function init() {
  try {
    const res = await fetch("./listening_data.json");
    listeningData = await res.json();
    const keys = Object.keys(listeningData);
    if (keys.length > 0) {
      renderTabs(keys);
      selectDay(keys[0]);
    }
  } catch (err) {
    currentDayTitleEl.textContent = "Lỗi tải file listening_data.json. Hãy kiểm tra cấu trúc thư mục!";
    console.error(err);
  }
}

function renderTabs(keys) {
  dayTabsEl.innerHTML = "";
  keys.forEach((key) => {
    const btn = document.createElement("button");
    btn.className = "day-tab";
    btn.dataset.day = key;
    btn.textContent = listeningData[key].title || key.toUpperCase();
    btn.onclick = () => selectDay(key);
    dayTabsEl.appendChild(btn);
  });
}

function selectDay(dayKey) {
  currentDayKey = dayKey;
  activeQuestionId = null;
  isSubmitted = false;
  resultBannerEl.classList.add("hidden");

  document.querySelectorAll(".day-tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.day === dayKey);
  });

  const dayObj = listeningData[dayKey];
  currentDayTitleEl.textContent = dayObj.title;
  renderDayNote(dayObj);

  // Dừng audio hiện tại và nạp sẵn câu đầu tiên (hoặc audioUrl chung nếu có)
  audioPlayer.pause();
  playPauseBtn.textContent = "▶";
  currentTimeLabel.textContent = "00:00";
  durationLabel.textContent = "00:00";
  seekBar.value = 0;

  if (dayObj.audioUrl) {
    audioPlayer.src = encodeURI(dayObj.audioUrl);
    audioPlayer.load();
  } else if (dayObj.questions && dayObj.questions.length > 0 && dayObj.questions[0].audio) {
    audioPlayer.src = encodeURI(dayObj.questions[0].audio);
    audioPlayer.load();
  } else {
    audioPlayer.removeAttribute("src");
  }

  renderQuestions();
  updateProgress();
}

function renderDayNote(dayObj) {
  let noteEl = document.getElementById("dayNote");
  if (!noteEl) {
    noteEl = document.createElement("div");
    noteEl.id = "dayNote";
    noteEl.className = "day-note";
    noteEl.style.cssText = "background:#fff7ed;border:1px solid #fdba74;color:#9a3412;padding:14px 16px;border-radius:12px;margin:12px 0;font-weight:600;line-height:1.6;box-shadow:0 2px 8px #f59e0b22";
    questionListEl.parentNode.insertBefore(noteEl, questionListEl);
  }
  if (dayObj.note && dayObj.note.trim() !== "") {
    noteEl.textContent = dayObj.note;
    noteEl.style.display = "block";
  } else {
    noteEl.textContent = "";
    noteEl.style.display = "none";
  }
}

function renderQuestions() {
  const dayObj = listeningData[currentDayKey];
  if (!userAnswers[currentDayKey]) {
    userAnswers[currentDayKey] = {};
  }

  questionListEl.innerHTML = "";

  dayObj.questions.forEach((q) => {
    const card = document.createElement("article");
    card.className = "card question-card";
    if (activeQuestionId === q.id) {
      card.style.borderColor = "var(--primary)";
    }

    // Header câu hỏi
    const header = document.createElement("div");
    header.className = "question-header";

    const title = document.createElement("span");
    title.className = "question-num";
    title.textContent = q.questionNumber || `${q.id}番`;

    const playBtn = document.createElement("button");
    playBtn.className = "play-q-btn";
    if (q.audio) {
      playBtn.innerHTML = activeQuestionId === q.id ? "🔊 Đang phát câu này" : "▶ Nghe câu này";
    } else {
      playBtn.innerHTML = `▶ Nghe câu này (${formatTime(q.startTime || 0)})`;
    }
    playBtn.onclick = () => playQuestionAudio(q);

    header.appendChild(title);
    header.appendChild(playBtn);
    card.appendChild(header);

    // Đề bài text (nếu có)
    if (q.prompt && q.prompt.trim() !== "") {
      const promptDiv = document.createElement("div");
      promptDiv.className = "question-prompt";
      promptDiv.style.whiteSpace = "pre-line";
      promptDiv.textContent = q.prompt;
      card.appendChild(promptDiv);
    }

    // Hình ảnh (nếu có)
    if (q.image) {
      const imgWrap = document.createElement("div");
      imgWrap.className = "question-image-wrap";
      const img = document.createElement("img");
      img.src = encodeURI(q.image);
      img.alt = `Hình minh họa câu ${q.id}`;
      img.loading = "lazy";
      img.style.maxWidth = "100%";
      img.style.maxHeight = "340px";
      img.style.borderRadius = "10px";
      img.style.display = "block";
      img.style.margin = "8px 0";
      img.style.cursor = "zoom-in";
      img.onclick = () => openImageModal(encodeURI(q.image));
      imgWrap.appendChild(img);
      card.appendChild(imgWrap);
    }

    // Các nút lựa chọn 1, 2, 3, (4)
    const optionsGrid = document.createElement("div");
    optionsGrid.className = "options-grid";
    const selectedVal = userAnswers[currentDayKey][q.id];

    q.options.forEach((opt) => {
      const btn = document.createElement("button");
      btn.className = "option-btn";
      btn.textContent = opt;

      if (selectedVal === opt) {
        btn.classList.add("selected");
      }

      if (isSubmitted && q.answer !== null && q.answer !== undefined) {
        const correctStr = String(q.answer);
        if (opt === correctStr) {
          btn.classList.add("correct");
        } else if (selectedVal === opt && selectedVal !== correctStr) {
          btn.classList.add("wrong");
        }
      }

      btn.onclick = () => {
        if (isSubmitted) return;
        userAnswers[currentDayKey][q.id] = opt;
        localStorage.setItem("jlpt_listening_answers", JSON.stringify(userAnswers));
        renderQuestions();
        updateProgress();
      };

      optionsGrid.appendChild(btn);
    });

    card.appendChild(optionsGrid);

    // Thông báo trạng thái khi nộp bài nhưng câu chưa có đáp án mẫu
    if (isSubmitted && (q.answer === null || q.answer === undefined)) {
      const note = document.createElement("div");
      note.className = "status-note no-key";
      note.textContent = selectedVal
        ? `Bạn đã chọn đáp án ${selectedVal} (Câu này chưa cập nhật đáp án mẫu trong JSON).`
        : "Bạn chưa chọn đáp án (Câu này chưa cập nhật đáp án mẫu trong JSON).";
      card.appendChild(note);
    }

    // Bảng sửa Key & Giây nhanh (khi bật Chế độ sửa Key)
    if (isEditMode) {
      const editPanel = document.createElement("div");
      editPanel.className = "edit-panel";

      // Chọn đáp án đúng
      const ansLabel = document.createElement("label");
      ansLabel.textContent = "Đáp án đúng:";
      const ansSelect = document.createElement("select");
      const nullOpt = document.createElement("option");
      nullOpt.value = "";
      nullOpt.textContent = "-- Trống --";
      ansSelect.appendChild(nullOpt);

      q.options.forEach((opt) => {
        const o = document.createElement("option");
        o.value = opt;
        o.textContent = opt;
        if (String(q.answer) === opt) o.selected = true;
        ansSelect.appendChild(o);
      });

      ansSelect.onchange = (e) => {
        q.answer = e.target.value === "" ? null : Number(e.target.value);
      };
      ansLabel.appendChild(ansSelect);
      editPanel.appendChild(ansLabel);

      // Chỉ hiện ô chỉnh giây nếu dùng chung 1 file audioUrl cả ngày
      if (!q.audio) {
        const timeLabel = document.createElement("label");
        timeLabel.textContent = "Giây bắt đầu:";
        const timeInput = document.createElement("input");
        timeInput.type = "number";
        timeInput.min = "0";
        timeInput.style.width = "70px";
        timeInput.value = q.startTime || 0;
        timeInput.onchange = (e) => {
          q.startTime = Number(e.target.value) || 0;
          playBtn.innerHTML = `▶ Nghe câu này (${formatTime(q.startTime)})`;
        };
        timeLabel.appendChild(timeInput);

        const grabTimeBtn = document.createElement("button");
        grabTimeBtn.className = "btn btn-outline";
        grabTimeBtn.style.padding = "4px 8px";
        grabTimeBtn.textContent = "⏱ Lấy giây đang phát";
        grabTimeBtn.onclick = () => {
          const currentSec = Math.floor(audioPlayer.currentTime);
          q.startTime = currentSec;
          timeInput.value = currentSec;
          playBtn.innerHTML = `▶ Nghe câu này (${formatTime(currentSec)})`;
        };

        editPanel.appendChild(timeLabel);
        editPanel.appendChild(grabTimeBtn);
      }

      card.appendChild(editPanel);
    }

    questionListEl.appendChild(card);
  });
}

function updateProgress() {
  const dayObj = listeningData[currentDayKey];
  const total = dayObj.questions.length;
  const answered = Object.keys(userAnswers[currentDayKey] || {}).length;
  progressTextEl.textContent = `Đã chọn: ${answered}/${total}`;
}

// Nộp bài
submitBtn.onclick = () => {
  isSubmitted = true;
  const dayObj = listeningData[currentDayKey];
  let correctCount = 0;
  let gradedCount = 0;

  dayObj.questions.forEach((q) => {
    if (q.answer !== null && q.answer !== undefined) {
      gradedCount++;
      if (userAnswers[currentDayKey][q.id] === String(q.answer)) {
        correctCount++;
      }
    }
  });

  resultBannerEl.classList.remove("hidden");
  if (gradedCount > 0) {
    resultBannerEl.textContent = `Kết quả: Đúng ${correctCount}/${gradedCount} câu đã có đáp án (Tổng ${dayObj.questions.length} câu).`;
  } else {
    resultBannerEl.textContent = `Đã ghi nhận bài làm của bạn! Hiện tại ngày này chưa có đáp án mẫu (answer) để chấm tự động.`;
  }

  renderQuestions();
  window.scrollTo({ top: 0, behavior: "smooth" });
};

// Làm lại
resetBtn.onclick = () => {
  userAnswers[currentDayKey] = {};
  localStorage.setItem("jlpt_listening_answers", JSON.stringify(userAnswers));
  isSubmitted = false;
  resultBannerEl.classList.add("hidden");
  renderQuestions();
  updateProgress();
};

// Chế độ sửa Key & Xuất JSON
toggleEditModeBtn.onclick = () => {
  isEditMode = !isEditMode;
  toggleEditModeBtn.classList.toggle("active", isEditMode);
  exportJsonBtn.classList.toggle("hidden", !isEditMode);
  renderQuestions();
};

exportJsonBtn.onclick = () => {
  const blob = new Blob([JSON.stringify(listeningData, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "listening_data.json";
  a.click();
  URL.revokeObjectURL(url);
};

// Phát Audio theo từng câu (hỗ trợ cả file rời q.audio lẫn file tổng audioUrl)
function playQuestionAudio(q) {
  const dayObj = listeningData[currentDayKey];
  activeQuestionId = q.id;
  renderQuestions();

  if (q.audio) {
    const encodedSrc = encodeURI(q.audio);
    audioPlayer.pause();
    audioPlayer.src = encodedSrc;
    audioPlayer.currentTime = 0;
    audioPlayer.playbackRate = playbackRates[rateIndex];
    audioPlayer.play().catch((err) => {
      alert(`Không tìm thấy hoặc không phát được file: ${q.audio}`);
      console.error(err);
    });
    playPauseBtn.textContent = "⏸";
  } else if (dayObj.audioUrl) {
    const encodedSrc = encodeURI(dayObj.audioUrl);
    if (!audioPlayer.src.endsWith(encodedSrc.replace("./", ""))) {
      audioPlayer.src = encodedSrc;
    }
    audioPlayer.currentTime = q.startTime || 0;
    audioPlayer.playbackRate = playbackRates[rateIndex];
    audioPlayer.play();
    playPauseBtn.textContent = "⏸";
  } else {
    alert("Chưa có đường dẫn file nghe cho câu này!");
  }
}

playPauseBtn.onclick = () => {
  if (!audioPlayer.src) return;
  if (audioPlayer.paused) {
    audioPlayer.play();
    playPauseBtn.textContent = "⏸";
  } else {
    audioPlayer.pause();
    playPauseBtn.textContent = "▶";
  }
};

rewindBtn.onclick = () => {
  audioPlayer.currentTime = Math.max(0, audioPlayer.currentTime - 5);
};

forwardBtn.onclick = () => {
  audioPlayer.currentTime = Math.min(audioPlayer.duration || 0, audioPlayer.currentTime + 5);
};

speedBtn.onclick = () => {
  rateIndex = (rateIndex + 1) % playbackRates.length;
  const newRate = playbackRates[rateIndex];
  audioPlayer.playbackRate = newRate;
  speedBtn.textContent = `${newRate}x`;
};

audioPlayer.ontimeupdate = () => {
  currentTimeLabel.textContent = formatTime(audioPlayer.currentTime);
  if (audioPlayer.duration) {
    seekBar.value = (audioPlayer.currentTime / audioPlayer.duration) * 100;
  }
};

audioPlayer.onloadedmetadata = () => {
  durationLabel.textContent = formatTime(audioPlayer.duration);
};

audioPlayer.onended = () => {
  playPauseBtn.textContent = "▶";
};

seekBar.oninput = () => {
  if (audioPlayer.duration) {
    audioPlayer.currentTime = (seekBar.value / 100) * audioPlayer.duration;
  }
};

function formatTime(sec) {
  if (!sec || isNaN(sec)) return "00:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// Modal phóng to ảnh
function openImageModal(src) {
  document.getElementById("modalImg").src = src;
  document.getElementById("imageModal").classList.remove("hidden");
}

function closeImageModal() {
  document.getElementById("imageModal").classList.add("hidden");
}

init();
