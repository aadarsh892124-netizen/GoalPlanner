
import './style.css'
import { LocalNotifications } from '@capacitor/local-notifications'
import { Capacitor } from '@capacitor/core'

// APP UI
document.querySelector('#app').innerHTML = `
  <h1>GOAL PLANNER</h1>
  <button id="enableNotifications">🔔 ENABLE NOTIFICATIONS</button>
  <p class="quote">"Dream Big. Start Small. Stay Consistent. Make It Happen."</p>

  <div class="analytics">
    <div class="stat-card"><h3>Total Goals</h3><p id="totalGoals">0</p></div>
    <div class="stat-card"><h3>Completed</h3><p id="completedGoals">0</p></div>
    <div class="stat-card"><h3>Pending</h3><p id="pendingGoals">0</p></div>
  </div>

  <div class="streak-cards">
    <div class="stat-card">
      <h3>🔥 Current Streak</h3>
      <p id="currentStreak">0 Days</p>
    </div>
    <div class="stat-card">
      <h3>🏆 Best Streak</h3>
      <p id="bestStreak">0 Days</p>
    </div>
  </div>

  <div class="progress-section">
    <h2>Overall Progress</h2>
    <div class="progress-bar"><div id="progressFill"></div></div>
    <p id="progressText">0% Completed</p>
  </div>

  <button class="add-goal" id="addGoal">+ ADD NEW GOAL</button>

  <div id="goalForm" style="display:none;">
    <h2>Create Your Goal</h2>
    <input type="text" id="goalName" placeholder="Enter your goal">
    <input type="date" id="goalDate">
    <input type="datetime-local" id="goalReminder">
    <button id="saveGoal">SAVE GOAL</button>
  </div>

  <div id="goalList"></div>
`

const $ = id => document.getElementById(id)

let goals = JSON.parse(localStorage.getItem('goals')) || []

function saveGoals() {
  localStorage.setItem('goals', JSON.stringify(goals))
}

// DATE HELPER
function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// STREAK SYSTEM
function getStreakStats() {
  const activityDays = [...new Set(
    goals.flatMap(goal =>
      (goal.tasks || [])
        .filter(task => task.completedAt)
        .map(task => task.completedAt)
    )
  )].sort()

  const today = getLocalDateKey()
  const yesterdayDate = new Date()
  yesterdayDate.setDate(yesterdayDate.getDate() - 1)
  const yesterday = getLocalDateKey(yesterdayDate)

  let current = 0
  let cursor = activityDays.includes(today)
    ? today
    : activityDays.includes(yesterday) ? yesterday : null

  while (cursor && activityDays.includes(cursor)) {
    current++
    const previous = new Date(cursor + 'T12:00:00')
    previous.setDate(previous.getDate() - 1)
    cursor = getLocalDateKey(previous)
  }

  let best = 0
  let run = 0
  let previousDate = null

  for (const day of activityDays) {
    if (previousDate) {
      const next = new Date(previousDate + 'T12:00:00')
      next.setDate(next.getDate() + 1)
      run = getLocalDateKey(next) === day ? run + 1 : 1
    } else {
      run = 1
    }

    best = Math.max(best, run)
    previousDate = day
  }

  $('currentStreak').textContent = `${current} Days`
  $('bestStreak').textContent = `${best} Days`
}

// ANALYTICS
function updateAnalytics() {
  const total = goals.length
  const completed = goals.filter(g => g.completed).length
  const progress = total ? Math.round(completed / total * 100) : 0

  $('totalGoals').textContent = total
  $('completedGoals').textContent = completed
  $('pendingGoals').textContent = total - completed
  $('progressFill').style.width = progress + '%'
  $('progressText').textContent = progress + '% Completed'

  getStreakStats()
}

// ANDROID NOTIFICATION SCHEDULING
async function scheduleGoalReminder(goal) {
  if (!goal.reminder) return

  if (!Capacitor.isNativePlatform()) {
    alert('Android app-la install pannumbodhu local reminders work aagum.')
    return
  }

  const reminderDate = new Date(goal.reminder)

  if (Number.isNaN(reminderDate.getTime()) || reminderDate <= new Date()) {
    alert('Please choose a future reminder date and time.')
    return
  }

  const permission = await LocalNotifications.checkPermissions()

  if (permission.display !== 'granted') {
    const requested = await LocalNotifications.requestPermissions()

    if (requested.display !== 'granted') {
      alert('Notification permission was not granted.')
      return
    }
  }

  const notificationId = Math.floor(Date.now() % 2147483647)

  await LocalNotifications.schedule({
    notifications: [
      {
        title: 'Goal Reminder 🔔',
        body: 'Time to work on: ' + goal.name,
        id: notificationId,
        schedule: {
          at: reminderDate
        }
      }
    ]
  })

  goal.reminderNotificationId = notificationId
  saveGoals()
}

// DISPLAY GOALS
function displayGoals() {
  $('goalList').innerHTML = ''

  goals.forEach((goal, index) => {
    if (!Array.isArray(goal.tasks)) goal.tasks = []

    const card = document.createElement('div')
    card.className = 'goal-card'

    const title = document.createElement('h3')
    title.textContent = goal.name

    const date = document.createElement('p')
    date.textContent = 'Target: ' + goal.date

    const status = document.createElement('p')
    status.textContent = goal.completed ? 'Completed ✓' : 'In Progress'

    card.append(title, date, status)

    if (goal.reminder) {
      const reminderInfo = document.createElement('p')
      reminderInfo.textContent =
        '🔔 Reminder: ' + new Date(goal.reminder).toLocaleString()
      card.appendChild(reminderInfo)
    }

    const totalTasks = goal.tasks.length
    const completedTasks = goal.tasks.filter(t => t.completed).length

    const taskProgress = totalTasks === 0
      ? 0
      : Math.round((completedTasks / totalTasks) * 100)

    const progressInfo = document.createElement('p')
    progressInfo.textContent =
      `${completedTasks}/${totalTasks} Tasks Completed (${taskProgress}%)`

    const goalProgressBar = document.createElement('div')
    goalProgressBar.className = 'goal-progress-bar'

    const goalProgressFill = document.createElement('div')
    goalProgressFill.className = 'goal-progress-fill'
    goalProgressFill.style.width = taskProgress + '%'

    goalProgressBar.appendChild(goalProgressFill)

    const taskHeading = document.createElement('h3')
    taskHeading.textContent = 'Daily Tasks & Subtasks'

    const taskInput = document.createElement('input')
    taskInput.placeholder = 'Enter a daily task'

    const addTask = document.createElement('button')
    addTask.textContent = '+ ADD TASK'

    addTask.onclick = () => {
      const taskName = taskInput.value.trim()

      if (!taskName) {
        alert('Enter a task first!')
        return
      }

      goal.tasks.push({ name: taskName, completed: false, subtasks: [] })
      saveGoals()
      displayGoals()
    }

    const taskList = document.createElement('div')

    goal.tasks.forEach((task, taskIndex) => {
      if (!Array.isArray(task.subtasks)) task.subtasks = []

      const taskRow = document.createElement('div')

      const checkbox = document.createElement('input')
      checkbox.type = 'checkbox'
      checkbox.checked = task.completed

      checkbox.onchange = () => {
        task.completed = checkbox.checked
        task.completedAt = checkbox.checked ? getLocalDateKey() : null
        saveGoals()
        displayGoals()
      }

      const taskLabel = document.createElement('span')
      taskLabel.textContent = task.name

      const deleteTask = document.createElement('button')
      deleteTask.textContent = 'DELETE'

      deleteTask.onclick = () => {
        goal.tasks.splice(taskIndex, 1)
        saveGoals()
        displayGoals()
      }

      taskRow.append(checkbox, taskLabel, deleteTask)

      const subtaskInput = document.createElement('input')
      subtaskInput.placeholder = 'Enter a subtask'

      const addSubtask = document.createElement('button')
      addSubtask.textContent = '+ ADD SUBTASK'

      addSubtask.onclick = () => {
        const name = subtaskInput.value.trim()

        if (!name) {
          alert('Enter a subtask first!')
          return
        }

        task.subtasks.push({ name, completed: false })
        saveGoals()
        displayGoals()
      }

      const subtaskList = document.createElement('div')

      task.subtasks.forEach((subtask, subIndex) => {
        const item = document.createElement('div')

        const check = document.createElement('input')
        check.type = 'checkbox'
        check.checked = subtask.completed

        check.onchange = () => {
          subtask.completed = check.checked
          saveGoals()
          displayGoals()
        }

        const label = document.createElement('span')
        label.textContent = subtask.name

        item.append(check, label)
        subtaskList.appendChild(item)
      })

      taskRow.append(subtaskInput, addSubtask, subtaskList)
      taskList.appendChild(taskRow)
    })

    const complete = document.createElement('button')
    complete.textContent = goal.completed ? 'COMPLETED' : 'MARK COMPLETE'
    complete.disabled = goal.completed

    complete.onclick = () => {
      goal.completed = true
      saveGoals()
      displayGoals()
    }

    const remove = document.createElement('button')
    remove.textContent = 'DELETE GOAL'

    remove.onclick = async () => {
      if (goal.reminderNotificationId && Capacitor.isNativePlatform()) {
        try {
          await LocalNotifications.cancel({
            notifications: [{ id: goal.reminderNotificationId }]
          })
        } catch (error) {
          console.error('Notification cancellation failed:', error)
        }
      }

      goals.splice(index, 1)
      saveGoals()
      displayGoals()
    }

    card.append(
      progressInfo,
      goalProgressBar,
      taskHeading,
      taskInput,
      addTask,
      taskList,
      complete,
      remove
    )

    $('goalList').appendChild(card)
  })

  updateAnalytics()
}

// ADD GOAL BUTTON
$('addGoal').onclick = () => {
  $('goalForm').style.display = 'block'
}

// SAVE GOAL BUTTON
$('saveGoal').onclick = async () => {
  const name = $('goalName').value.trim()
  const date = $('goalDate').value
  const reminder = $('goalReminder').value

  if (!name || !date) {
    alert('Please enter your goal and target date!')
    return
  }

  const goal = {
    name,
    date,
    reminder,
    completed: false,
    tasks: []
  }

  goals.push(goal)
  saveGoals()

  try {
    await scheduleGoalReminder(goal)
  } catch (error) {
    console.error('Reminder scheduling failed:', error)
    alert('Could not schedule reminder: ' + error.message)
  }

  $('goalName').value = ''
  $('goalDate').value = ''
  $('goalReminder').value = ''
  $('goalForm').style.display = 'none'

  saveGoals()
  displayGoals()
}

// ENABLE NOTIFICATIONS BUTTON
$('enableNotifications').onclick = async () => {
  try {
    if (Capacitor.isNativePlatform()) {
      const permission = await LocalNotifications.requestPermissions()

      if (permission.display === 'granted') {
        alert('Notifications enabled successfully!')
      } else {
        alert('Notification permission was not granted.')
      }
    } else {
      const permission = await Notification.requestPermission()

      if (permission === 'granted') {
        alert('Browser notifications enabled!')
      } else {
        alert('Notification permission was not granted.')
      }
    }
  } catch (error) {
    alert('Notification setup failed: ' + error.message)
  }
}

// INITIAL DISPLAY
displayGoals()
