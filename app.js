// DOM Elements
const timeline = document.getElementById('timeline');
const emptyState = document.getElementById('emptyState');
const addTaskBtn = document.getElementById('addTaskBtn');
const taskModal = document.getElementById('taskModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const cancelBtn = document.getElementById('cancelBtn');
const taskForm = document.getElementById('taskForm');
const taskDateInput = document.getElementById('taskDate');
const currentDateEl = document.getElementById('currentDate');
const fabAddTask = document.getElementById('fabAddTask');
const taskDateFilter = document.getElementById('taskDateFilter');
const todayChip = document.getElementById('todayChip');
const tomorrowChip = document.getElementById('tomorrowChip');
const scheduleDateLabel = document.getElementById('scheduleDateLabel');
const diaryEntry = document.getElementById('diaryEntry');
const saveDiaryBtn = document.getElementById('saveDiaryBtn');
const diaryStatus = document.getElementById('diaryStatus');
const diaryDateLabel = document.getElementById('diaryDateLabel');
const calendarPrev = document.getElementById('calendarPrev');
const calendarNext = document.getElementById('calendarNext');
const calendarGrid = document.getElementById('calendarGrid');
const calendarMonthLabel = document.getElementById('calendarMonthLabel');
const goalsForm = document.getElementById('goalsForm');
const goalTitleInput = document.getElementById('goalTitle');
const goalsList = document.getElementById('goalsList');
const goalsEmpty = document.getElementById('goalsEmpty');
const menuToggle = document.getElementById('menuToggle');
const menuClose = document.getElementById('menuClose');
const menuOverlay = document.getElementById('menuOverlay');
const sideMenu = document.getElementById('sideMenu');

// State
const STORAGE_KEY = 'timeflow_tasks';
const DIARY_STORAGE_KEY = 'timeflow_diary_entries';
const DIARY_LEGACY_KEY = 'timeflow_diary';
const DIARY_LAST_DATE_KEY = 'timeflow_diary_last_date';
const GOALS_STORAGE_KEY = 'timeflow_goals';
let tasks = [];
let editingTaskId = null;
let diarySaveTimer = null;
let diaryEntries = {};
let diarySelectedDate = null;
let diaryViewMonth = null;
let goals = [];
let selectedTaskDate = null;

// Initialize
function init() {
    if (currentDateEl) renderDate();
    if (timeline) {
        loadTasks();
        setSelectedTaskDate(getTodayString());
        setInterval(updateActiveTask, 60000); // Check every minute
    }
    if (diaryEntry) loadDiary();
    if (goalsList) {
        loadGoals();
        renderGoals();
    }
    setupEventListeners();
}

// Render Date
function renderDate() {
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    currentDateEl.textContent = now.toLocaleDateString('zh-TW', options);
}

// Render Tasks
function renderTasks() {
    if (!timeline || !emptyState) return;
    const activeDate = selectedTaskDate || getTodayString();
    // Sort tasks by start time
    const filteredTasks = tasks
        .filter(task => task.date === activeDate)
        .sort((a, b) => a.startTime.localeCompare(b.startTime));

    // Clear timeline (keep empty state if needed)
    timeline.innerHTML = '';

    if (filteredTasks.length === 0) {
        timeline.appendChild(emptyState);
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';

    filteredTasks.forEach(task => {
        const taskEl = createTaskElement(task);
        timeline.appendChild(taskEl);
    });
    
    updateActiveTask();
}

function setSelectedTaskDate(dateString) {
    const parsed = parseDateString(dateString) || new Date();
    selectedTaskDate = getLocalDateString(parsed);

    if (taskDateFilter) taskDateFilter.value = selectedTaskDate;
    if (scheduleDateLabel) scheduleDateLabel.textContent = formatDateLabel(parsed);

    if (todayChip) todayChip.classList.toggle('active', selectedTaskDate === getTodayString());
    if (tomorrowChip) tomorrowChip.classList.toggle('active', selectedTaskDate === getTomorrowString());

    renderTasks();
}

function renderGoals() {
    if (!goalsList || !goalsEmpty) return;
    goalsList.innerHTML = '';

    if (goals.length === 0) {
        goalsList.appendChild(goalsEmpty);
        goalsEmpty.style.display = 'block';
        return;
    }

    goalsEmpty.style.display = 'none';

    goals.forEach(goal => {
        const item = document.createElement('div');
        item.className = `goal-item${goal.completed ? ' completed' : ''}`;
        item.dataset.id = goal.id;

        item.innerHTML = `
            <div class="goal-main">
                <input type="checkbox" class="goal-checkbox" ${goal.completed ? 'checked' : ''}>
                <div class="goal-title">${goal.title}</div>
            </div>
            <div class="goal-actions">
                <button class="goal-delete" type="button" aria-label="刪除目標">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        `;

        const checkbox = item.querySelector('.goal-checkbox');
        const deleteBtn = item.querySelector('.goal-delete');

        checkbox.addEventListener('click', () => toggleGoal(goal.id));
        deleteBtn.addEventListener('click', () => deleteGoal(goal.id));

        goalsList.appendChild(item);
    });
}

// Create Task HTML Element
function createTaskElement(task) {
    const div = document.createElement('div');
    div.className = 'task-item';
    div.dataset.id = task.id;
    div.dataset.startTime = task.startTime;
    div.dataset.endTime = task.endTime;
    
    const isCompleted = task.completed ? 'completed' : '';
    const isChecked = task.completed ? 'checked' : '';

    div.innerHTML = `
        <div class="time-indicator">${task.startTime}</div>
        <div class="task-card ${task.color} ${isCompleted}" onclick="editTask(${task.id})">
            <div class="task-content-wrapper">
                <input type="checkbox" class="task-checkbox" ${isChecked} onclick="event.stopPropagation(); toggleComplete(${task.id})">
                <div class="task-details">
                    <div class="task-header">
                        <div class="task-title">${task.title}</div>
                        <button class="delete-btn" onclick="event.stopPropagation(); deleteTask(${task.id})">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                    <div class="task-time">
                        <i class="fa-regular fa-clock"></i>
                        ${task.startTime} - ${task.endTime}
                    </div>
                </div>
            </div>
        </div>
    `;
    return div;
}

// Add or Update Task
function saveTask(e) {
    e.preventDefault();

    const title = document.getElementById('taskTitle').value;
    const startTime = document.getElementById('startTime').value;
    const endTime = document.getElementById('endTime').value;
    const date = taskDateInput ? taskDateInput.value : selectedTaskDate || getTodayString();
    const color = document.querySelector('input[name="color"]:checked').value;

    if (!title || !startTime || !endTime || !date) return;

    if (editingTaskId) {
        // Update existing task
        const taskIndex = tasks.findIndex(t => t.id === editingTaskId);
        if (taskIndex > -1) {
            tasks[taskIndex] = {
                ...tasks[taskIndex],
                title,
                startTime,
                endTime,
                date,
                color
            };
        }
    } else {
        // Create new task
        const newTask = {
            id: Date.now(),
            title,
            startTime,
            endTime,
            date,
            color,
            completed: false
        };
        tasks.push(newTask);
    }

    saveTasks();
    if (timeline && date !== selectedTaskDate) {
        setSelectedTaskDate(date);
    } else {
        renderTasks();
    }
    closeModal();
    taskForm.reset();
    editingTaskId = null;
}

// Edit Task
window.editTask = function(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    editingTaskId = id;
    document.getElementById('taskTitle').value = task.title;
    document.getElementById('startTime').value = task.startTime;
    document.getElementById('endTime').value = task.endTime;
    if (taskDateInput) taskDateInput.value = task.date || getTodayString();
    
    // Select color
    const colorInput = document.querySelector(`input[name="color"][value="${task.color}"]`);
    if (colorInput) colorInput.checked = true;

    // Update modal title
    document.querySelector('.modal-header h3').textContent = '編輯行程';
    document.querySelector('.btn-primary[type="submit"]').textContent = '儲存變更';

    openModal(false); // false = don't reset form
};

// Toggle Complete
window.toggleComplete = function(id) {
    const task = tasks.find(t => t.id === id);
    if (task) {
        task.completed = !task.completed;
        saveTasks();
        renderTasks();
    }
};

// Delete Task
window.deleteTask = function(id) {
    tasks = tasks.filter(t => t.id !== id);
    saveTasks();
    renderTasks();
};

// Update Active Task Highlight
function updateActiveTask() {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    document.querySelectorAll('.task-card').forEach(card => {
        card.classList.remove('active');
    });

    if (selectedTaskDate !== getTodayString()) return;

    tasks.forEach(task => {
        if (task.completed) return;
        if (task.date !== selectedTaskDate) return;

        const [startHour, startMin] = task.startTime.split(':').map(Number);
        const [endHour, endMin] = task.endTime.split(':').map(Number);
        
        const startTotal = startHour * 60 + startMin;
        const endTotal = endHour * 60 + endMin;

        if (currentMinutes >= startTotal && currentMinutes < endTotal) {
            const taskEl = document.querySelector(`.task-item[data-id="${task.id}"] .task-card`);
            if (taskEl) taskEl.classList.add('active');
        }
    });
}

// Load from LocalStorage
function loadTasks() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) {
            tasks = [];
            return;
        }
        const parsed = JSON.parse(stored);
        tasks = Array.isArray(parsed) ? parsed : [];

        const fallbackDate = getTodayString();
        let needsSave = false;
        tasks = tasks.map(task => {
            if (!task.date) {
                needsSave = true;
                return { ...task, date: fallbackDate };
            }
            return task;
        });

        if (needsSave) saveTasks();
    } catch (error) {
        console.warn('Failed to load tasks from storage.', error);
        tasks = [];
    }
}

// Save to LocalStorage
function saveTasks() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch (error) {
        console.warn('Failed to save tasks to storage.', error);
    }
}

function getLocalDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function parseDateString(value) {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
        return null;
    }
    return date;
}

function getTodayString() {
    return getLocalDateString(new Date());
}

function getTomorrowString() {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    return getLocalDateString(date);
}

function formatDateLabel(date) {
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

function loadDiaryEntries() {
    diaryEntries = {};
    try {
        const stored = localStorage.getItem(DIARY_STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                diaryEntries = parsed;
            }
        }
    } catch (error) {
        console.warn('Failed to load diary entries from storage.', error);
    }

    try {
        const legacy = localStorage.getItem(DIARY_LEGACY_KEY);
        if (legacy && Object.keys(diaryEntries).length === 0) {
            diaryEntries[getTodayString()] = legacy;
            saveDiaryEntries();
        }
    } catch (error) {
        console.warn('Failed to migrate legacy diary entry.', error);
    }
}

function saveDiaryEntries() {
    try {
        localStorage.setItem(DIARY_STORAGE_KEY, JSON.stringify(diaryEntries));
    } catch (error) {
        console.warn('Failed to save diary entries to storage.', error);
    }
}

function loadGoals() {
    goals = [];
    try {
        const stored = localStorage.getItem(GOALS_STORAGE_KEY);
        if (!stored) return;
        const parsed = JSON.parse(stored);
        goals = Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.warn('Failed to load goals from storage.', error);
        goals = [];
    }
}

function saveGoals() {
    try {
        localStorage.setItem(GOALS_STORAGE_KEY, JSON.stringify(goals));
    } catch (error) {
        console.warn('Failed to save goals to storage.', error);
    }
}

function addGoal(title) {
    const trimmed = title.trim();
    if (!trimmed) return;
    goals.unshift({
        id: Date.now(),
        title: trimmed,
        completed: false
    });
    saveGoals();
    renderGoals();
}

function toggleGoal(id) {
    const goal = goals.find(item => item.id === id);
    if (!goal) return;
    goal.completed = !goal.completed;
    saveGoals();
    renderGoals();
}

function deleteGoal(id) {
    goals = goals.filter(item => item.id !== id);
    saveGoals();
    renderGoals();
}

// Load Diary
function loadDiary() {
    if (!diaryEntry) return;
    loadDiaryEntries();

    const lastDate = localStorage.getItem(DIARY_LAST_DATE_KEY);
    const lastDateParsed = parseDateString(lastDate);
    diarySelectedDate = lastDateParsed ? lastDate : getTodayString();
    diaryViewMonth = parseDateString(diarySelectedDate) || new Date();
    diaryViewMonth.setDate(1);

    setDiarySelectedDate(diarySelectedDate);
    renderCalendar();
}

// Save Diary
function saveDiary(statusMessage = '') {
    if (!diaryEntry) return;
    if (!diarySelectedDate) diarySelectedDate = getTodayString();
    diaryEntries[diarySelectedDate] = diaryEntry.value || '';
    saveDiaryEntries();
    if (statusMessage) setDiaryStatus(statusMessage);
}

function setDiarySelectedDate(dateString, options = {}) {
    const parsed = parseDateString(dateString);
    if (!parsed || !diaryEntry) return;
    diarySelectedDate = dateString;
    diaryEntry.value = diaryEntries[dateString] || '';

    if (diaryDateLabel) diaryDateLabel.textContent = formatDateLabel(parsed);
    localStorage.setItem(DIARY_LAST_DATE_KEY, dateString);

    if (options.focus) diaryEntry.focus();
}

function renderCalendar() {
    if (!calendarGrid || !calendarMonthLabel || !diaryViewMonth) return;
    const year = diaryViewMonth.getFullYear();
    const month = diaryViewMonth.getMonth();
    const todayString = getTodayString();

    calendarMonthLabel.textContent = `${year}年${month + 1}月`;
    calendarGrid.innerHTML = '';

    const firstDay = new Date(year, month, 1);
    const startWeekday = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let i = 0; i < startWeekday; i++) {
        const filler = document.createElement('div');
        filler.className = 'calendar-day is-out';
        calendarGrid.appendChild(filler);
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const dateString = getLocalDateString(date);
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'calendar-day';
        button.textContent = day;
        button.dataset.date = dateString;

        if (dateString === todayString) button.classList.add('is-today');
        if (dateString === diarySelectedDate) button.classList.add('is-selected');

        calendarGrid.appendChild(button);
    }

    const totalCells = startWeekday + daysInMonth;
    const tailCells = (7 - (totalCells % 7)) % 7;
    for (let i = 0; i < tailCells; i++) {
        const filler = document.createElement('div');
        filler.className = 'calendar-day is-out';
        calendarGrid.appendChild(filler);
    }
}

function setDiaryStatus(message) {
    if (!diaryStatus) return;
    diaryStatus.textContent = message;
    if (!message) return;

    const current = message;
    setTimeout(() => {
        if (diaryStatus.textContent === current) diaryStatus.textContent = '';
    }, 1500);
}

// Modal Controls
function openModal(reset = true) {
    if (!taskModal || !taskForm) return;
    taskModal.classList.add('active');
    
    if (reset) {
        editingTaskId = null;
        taskForm.reset();
        document.querySelector('.modal-header h3').textContent = '新增行程';
        document.querySelector('.btn-primary[type="submit"]').textContent = '確認新增';

        if (taskDateInput) {
            taskDateInput.value = selectedTaskDate || getTodayString();
        }
        
        // Set default time
        const now = new Date();
        now.setMinutes(Math.ceil(now.getMinutes() / 30) * 30);
        const timeString = now.toTimeString().slice(0, 5);
        document.getElementById('startTime').value = timeString;
        
        now.setHours(now.getHours() + 1);
        const endTimeString = now.toTimeString().slice(0, 5);
        document.getElementById('endTime').value = endTimeString;
    }
}

function closeModal() {
    if (!taskModal) return;
    taskModal.classList.remove('active');
    editingTaskId = null;
}

// Event Listeners
function setupEventListeners() {
    if (addTaskBtn) addTaskBtn.addEventListener('click', () => openModal(true));
    if (fabAddTask) fabAddTask.addEventListener('click', () => openModal(true));
    if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    if (taskModal) {
        taskModal.addEventListener('click', (e) => {
            if (e.target === taskModal) closeModal();
        });
    }
    if (taskForm) taskForm.addEventListener('submit', saveTask);

    if (taskDateFilter) {
        taskDateFilter.addEventListener('change', (event) => {
            setSelectedTaskDate(event.target.value || getTodayString());
        });
    }

    if (todayChip) todayChip.addEventListener('click', () => setSelectedTaskDate(getTodayString()));
    if (tomorrowChip) tomorrowChip.addEventListener('click', () => setSelectedTaskDate(getTomorrowString()));

    if (saveDiaryBtn && diaryEntry) {
        saveDiaryBtn.addEventListener('click', () => saveDiary('已儲存'));
        diaryEntry.addEventListener('input', () => {
            if (diarySaveTimer) clearTimeout(diarySaveTimer);
            diarySaveTimer = setTimeout(() => {
                saveDiary('已自動儲存');
            }, 800);
        });
    }

    if (calendarPrev && calendarNext && calendarGrid) {
        calendarPrev.addEventListener('click', () => {
            if (!diaryViewMonth) return;
            diaryViewMonth.setMonth(diaryViewMonth.getMonth() - 1);
            diaryViewMonth.setDate(1);
            renderCalendar();
        });

        calendarNext.addEventListener('click', () => {
            if (!diaryViewMonth) return;
            diaryViewMonth.setMonth(diaryViewMonth.getMonth() + 1);
            diaryViewMonth.setDate(1);
            renderCalendar();
        });

        calendarGrid.addEventListener('click', (event) => {
            const target = event.target.closest('button[data-date]');
            if (!target) return;
            if (diaryEntry) saveDiary();
            setDiarySelectedDate(target.dataset.date, { focus: true });
            renderCalendar();
        });
    }

    if (goalsForm && goalTitleInput) {
        goalsForm.addEventListener('submit', (event) => {
            event.preventDefault();
            addGoal(goalTitleInput.value);
            goalTitleInput.value = '';
            goalTitleInput.focus();
        });
    }

    if (menuToggle && sideMenu && menuOverlay) {
        menuToggle.addEventListener('click', openMenu);
        menuOverlay.addEventListener('click', closeMenu);
    }

    if (menuClose) menuClose.addEventListener('click', closeMenu);
    if (sideMenu) {
        sideMenu.querySelectorAll('.menu-link').forEach(link => {
            link.addEventListener('click', closeMenu);
        });
    }
}

function openMenu() {
    if (!sideMenu || !menuOverlay) return;
    sideMenu.classList.add('active');
    menuOverlay.classList.add('active');
    menuOverlay.setAttribute('aria-hidden', 'false');
}

function closeMenu() {
    if (!sideMenu || !menuOverlay) return;
    sideMenu.classList.remove('active');
    menuOverlay.classList.remove('active');
    menuOverlay.setAttribute('aria-hidden', 'true');
}

// Start App
init();
