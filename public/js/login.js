document.querySelector('form').addEventListener('submit', function(e) {
    const username = document.querySelector('#username').value;
    const password = document.querySelector('#password').value;
    if(!username || !password) {
        e.preventDefault();
        alert('Please fill out all fields');
        return;
    }
})