document.addEventListener("DOMContentLoaded", async () => {
  const token = localStorage.getItem("token");
  if (!token) {
    window.location.href = "/login";
  }

  await fetchAndPopulateCategories(token);

  const categoryFilter = document.getElementById("categoryFilter");
  categoryFilter.addEventListener("change", FetchToDisplayTheTasks);

  FetchToDisplayTheTasks();
});

async function fetchAndPopulateCategories(token) {
  try {
    const categoriesResponse = await fetch('/categories', {
      headers: {
        'Authorization': `${token}`,
      },
    });

    if (!categoriesResponse.ok) {
      throw new Error(`Categories request failed with status ${categoriesResponse.status}`);
    }

    const categoriesData = await categoriesResponse.json();

    const categoryFilterSelect = document.getElementById('categoryFilter');
    categoryFilterSelect.innerHTML = '<option value="">All</option>';

    categoriesData.forEach(category => {
      const option = document.createElement('option');
      option.value = category;
      option.textContent = category;
      categoryFilterSelect.appendChild(option);
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
  }
}

async function FetchToDisplayTheTasks() {
  const token = localStorage.getItem("token");
  try {
    const category = document.getElementById("categoryFilter").value;
    const sortOption = document.getElementById("sortOption").value;
    const search = document.getElementById("searchInput").value;
    const status = document.getElementById("statusFilter").value;

    const userInfo = await fetch('/user', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `${token}`,
      },
    })
      .then(response => response.json())
      .catch(error => {
        console.error('User information fetch error:', error);
        return {};
      });

    const userId = userInfo.userId;

    const apiUrl = `/tasks?sortBy=${sortOption}&category=${category}&status=${status}&search=${search}&userId=${userId}`;

    fetch(apiUrl, {
      headers: {
        Authorization: `${token}`,
      },
    })
      .then((response) => response.json())
      .then((tasks) => DisplayTheTasks(tasks))
      .catch((error) => console.error(error));

  } catch (error) {
    console.error('Error fetching tasks:', error);
  }
}


function logout() {
  localStorage.removeItem("token");
  window.history.replaceState({}, document.title, "/login");
  window.location.href = "/login";
}

function GoBack() {
  window.location.href = "/viewTasks";
}

function calculateRemainingDays(dueDate, timeZone) {
  const now = moment().tz(timeZone).startOf('day');
  const due = moment.utc(dueDate).tz(timeZone);

  const nowDayOfYear = now.dayOfYear();
  const dueDayOfYear = due.dayOfYear();

  const daysRemaining = dueDayOfYear - nowDayOfYear;
  return daysRemaining;
}

function mapPriorityValueToLabel(value) {
  switch (value) {
    case 1:
      return "HIGH";
    case 2:
      return "MEDIUM";
    case 3:
      return "LOW";
    default:
      return "";
  }
}

function DisplayTheTasks(tasks) {
  const table = document.getElementById("taskTable");
  const noDiv = document.getElementById("noTask");
  if (tasks.length == 0) {
    table.style.display = "none";
    noDiv.style.display = "block";
    noDiv.innerHTML = "<h2>No tasks found</h2> <br> <img id='noTaskImg' src='./Assets/task-list.png'>";
    return;
  }
  else {
    noDiv.style.display = "none";
    table.style.display = "block";
  }
  const viewTasks = document.getElementById("viewTasks");
  viewTasks.innerHTML = "";

  tasks.forEach((task) => {
    // Format the dueDate to a string with "dd-mm-yyyy" format
    const formattedDueDate = new Date(task.dueDate).toLocaleDateString(
      "en-GB",
      {
        day: "numeric",
        month: "numeric",
        year: "numeric",
      }
    );
    var remainingDays = calculateRemainingDays(task.dueDate, 'Asia/Dhaka') + " day(s)";
    var statusIcon;
    var statusButton;
    const row = document.createElement("tr");
    if (calculateRemainingDays(task.dueDate, 'Asia/Dhaka') == 0 && task.status !== "completed") {
      row.classList.add("warning-task");
    }
    if (calculateRemainingDays(task.dueDate, 'Asia/Dhaka') < 0 && task.status !== "completed") {
      row.classList.add("missing-task");
    }
    if (task.status === "completed") {
      statusIcon = "<img width='32' height='32' src='https://img.icons8.com/color/48/checked-checkbox.png' alt='checked-checkbox'/>"
      statusButton = "<img class='iconImg' src='data:image/png;base64,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'>";
      remainingDays = "";
      row.classList.remove("warning-task");
      row.classList.remove("missing-task");
      row.classList.add("completed-task");
    }
    else {
      statusButton = "<img class='iconImg' src='data:image/png;base64,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'>";
      statusIcon = "<img width='32' height='32' src='data:image/png;base64,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'>";
      if (calculateRemainingDays(task.dueDate, 'Asia/Dhaka') < 0) {
        statusIcon = "<img width='32' height='32' src='https://img.icons8.com/officel/128/leave.png' alt='leave'/>";
      }
    }
    row.innerHTML = `
    <td>${task.title}</td>
    <td class="desc-data">${task.description}</td>
    <td>${formattedDueDate}<br>${remainingDays}</td>
    <td>${statusIcon}</td>
    <td>${mapPriorityValueToLabel(task.priority)}</td>
    <td>${task.category}</td>
    <td class="action-column">
    <button class="iconBtn" id="doneIcon" onclick="ChangeToCompleted('${task._id}')">${statusButton}</button>
    <button class="iconBtn" onclick="EditTask('${task._id}')"><img class="iconImg" src="data:image/png;base64,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"></button>

    <button class="iconBtn" onclick="DetailsShow('${task._id}')"><img class="iconImg" src="data:image/png;base64,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"></button>
    <button class="iconBtn" id="delIcon" onclick="RemoveTasks('${task._id}')"><img class="iconImg" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADwAAAA8CAYAAAA6/NlyAAAACXBIWXMAAAsTAAALEwEAmpwYAAABTElEQVR4nO2asWoCQRCG5yFSpEuTwiYQ8gRq6RtY30OkvWdIMtpZWoV0sqwiuTZFykiaFFPlMUZWWa0SEtzB0fs/+GEPlr35mb27H/aIAACgbTzSossUa0ule5AXeFPUXG0Va/ICw/C8XR1+otgc+sxu1zgRw1ygOIs1i3GWhj8qrX/Sa/+7md19aVa6/m3+X/TfNYsbXlWqngXDh7Jy0EV0uDLc0pPB8jlp2ntTT8p1FTdMRMOk+6sH9aRcl4Xhm6RxJ6on5brIinAr6klmRjPHNujK8Mv1p04v3zdKY8s5LgyPLuIu+6ax5RwYtiKgw4ItzXiGBS8txlta8FlifIcFwYOsCQgeguDBCB6C4MEIHoLgwQgeguBBCB6FCUhagqTFbUla407cHXKlseUcGLYiODhPctPhAMOCDodT29K0/8XAi2AYAADoXFgDz8YwKEnZk6YAAAAASUVORK5CYII="></button>
    </td>
    `;
    viewTasks.appendChild(row);
  });
}

function DetailsShow(taskId) {
  const token = localStorage.getItem("token");

  fetch(`/tasks/${taskId}`, {
    headers: {
      Authorization: `${token}`,
    },
  })
    .then((response) => response.json())
    .then((task) => {
      const formattedDueDate = new Date(task.dueDate).toLocaleDateString(
        "en-GB",
        {
          day: "numeric",
          month: "numeric",
          year: "numeric",
        }
      );
      var status;
      if (task.status === "completed")
        status = "Not Done";
      else
        status = "Complete";

      const due = calculateRemainingDays(task.dueDate, 'Asia/Dhaka');
      const taskDetailsContent = document.getElementById("taskDetailsContent");
      taskDetailsContent.innerHTML = `
      <p><strong>Title&emsp;&emsp;&emsp;&emsp;: </strong> ${task.title}</p>
      <p><strong>Description&ensp;: </strong> ${task.description}</p>
      <p><strong>Due&ensp;Date&emsp;&ensp;: </strong> ${formattedDueDate} (${due} days)</p>
      <p><strong>Priority&emsp;&emsp;&ensp;: </strong> ${mapPriorityValueToLabel(task.priority)}</p>
      <p><strong>Status&emsp;&emsp;&emsp;: </strong> ${task.status}</p>
      <p><strong>Category&ensp;&emsp;: </strong> ${task.category}</p>
      <center>
      <button onclick="EditTask('${task._id}')">Edit</button>
      <button id="statusBtn" onclick="ChangeToCompleted('${task._id}')">${status}</button>
      <button onclick="RemoveTasks('${task._id}')">Delete</button>
      </center>
      `;
      document.getElementById("statusBtn").addEventListener("click", function () {
        if (document.getElementById("statusBtn").innerHTML === "Complete") {
          document.getElementById("statusBtn").innerHTML = "Not Done";
        } else {
          document.getElementById("statusBtn").innerHTML = "Complete";
        }
      });
      OpenDetailsWindow();
    })
    .catch((error) => console.error(error));
}

function OpenDetailsWindow() {
  const taskDetailsModal = document.getElementById("taskDetailsModal");
  taskDetailsModal.style.display = "block";
}

function CloseDetailsWindow() {
  const taskDetailsModal = document.getElementById("taskDetailsModal");
  taskDetailsModal.style.display = "none";
}

function ChangeToCompleted(taskId) {
  const token = localStorage.getItem("token");

  fetch(`/tasks/${taskId}/complete`, {
    method: "PUT",
    headers: {
      Authorization: `${token}`,
    },
  })
    .then((response) => {
      if (response.ok) {
        FetchToDisplayTheTasks();
      } else {
        console.error("Marking task as completed Failed");
      }
    })
    .catch((error) => console.error(error));
}


function RemoveTasks(taskId) {
  const token = localStorage.getItem("token");

  fetch(`/tasks/${taskId}`, {
    method: "DELETE",
    headers: {
      Authorization: `${token}`,
    },
  })
    .then((response) => {
      if (response.ok) {
        FetchToDisplayTheTasks();
        CloseDetailsWindow();
      } else {
        console.error("Delete task Failed");
      }
    })
    .catch((error) => console.error(error));
}

let currentTaskId;

function EditTask(taskId) {
  const token = localStorage.getItem("token");

  fetch(`/tasks/${taskId}`, {
    headers: {
      Authorization: `${token}`,
    },
  })
    .then((response) => response.json())
    .then((task) => {
      currentTaskId = taskId;
      document.getElementById("editTitle").value = task.title;
      document.getElementById("editDescription").value = task.description;
      const dueDate = new Date(task.dueDate).toISOString().split('T')[0];
      document.getElementById("editDueDate").value = dueDate;
      document.getElementById("editPriority").value = task.priority;
      document.getElementById("editCategory").value = task.category;

      OpenEditWindow();
    })
    .catch((error) => console.error(error));
}

function OpenEditWindow() {
  const editModal = document.getElementById("editModal");
  editModal.style.display = "block";
}

function CloseEditWindow() {
  const editModal = document.getElementById("editModal");
  editModal.style.display = "none";
}

function SubmitEditForm() {
  const token = localStorage.getItem("token");

  const dueDate = document.getElementById("editDueDate").value;
  const description = document.getElementById("editDescription").value;
  const title = document.getElementById("editTitle").value;
  const category = document.getElementById("editCategory").value;
  const priority = document.getElementById("editPriority").value;

  fetch(`/tasks/${currentTaskId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `${token}`,
    },
    body: JSON.stringify({
      title: title,
      description: description,
      dueDate: dueDate,
      priority: priority,
      category: category,
    }),
  })
    .then((response) => {
      if (response.ok) {
        console.log("Test: " + description);
        return response.json();
      } else {
        throw new Error("Failed to update task");
      }
    })
    .then((updatedTask) => {
      console.log("Task updated successfully:", updatedTask);
      FetchToDisplayTheTasks();
      CloseEditWindow();
    })
    .catch((error) => console.error(error));
}
