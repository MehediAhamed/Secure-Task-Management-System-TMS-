var userInfo = {};
window.onload = async function () {
    const token = localStorage.getItem("token");

    if (!token) {
        window.location.href = "/login";
    }

    try {
        userInfo = await fetch('/user', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `${token}`,
            },
        }).then(response => response.json());        
        // Handle the user information
        document.getElementById('userinfo').innerHTML =userInfo.username;
        console.log(userInfo);
    } catch (error) {
        console.error('User information fetch error:', error);
        // Handle the error as needed
    }
};

function formatCategory(rawCategory) {
    return rawCategory.charAt(0).toUpperCase() + rawCategory.slice(1).toLowerCase();
}

async function createNewTask(event) {
    event.preventDefault();
    const form = event.target;
    form.reportValidity();
    if (!form.checkValidity()) {
        return;
    }

    const token = localStorage.getItem("token");
    const title = document.getElementById('title').value;
    const description = document.getElementById('description').value;
    const dueDate = document.getElementById('dueDate').value;
    const priority = document.getElementById('priority').value;
    const category = formatCategory(document.getElementById('category').value);

    try {
        const userId = userInfo.userId;
        console.log('User ID:', userId);

        if (!userId) {
            console.error('User ID not found in user information:', userInfo);
            throw new Error('User ID not found');
        }

        const response = await fetch('/tasks/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `${token}`,
            },
            body: JSON.stringify({
                title: title,
                description: description,
                dueDate: dueDate,
                priority: priority,
                category: category,
                user: userId,
            }),
        });

        console.log('Response Status:', response.status);

        if (response.ok) {
            alert('Task created successfully');
            window.location.reload();
        } else {
            const errorData = await response.json();
            console.error('Server error:', errorData);
            throw new Error('Task creation failed');
        }
    } catch (error) {
        console.error('Task creation error:', error);
    }
}        

document.getElementById('nextButton').addEventListener('click', function (event) {
    event.preventDefault();
    window.location.href = '/';
});
        