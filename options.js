let count = 1;

function save_options() {
    chrome.storage.sync.clear();

    var textHostnames = document.getElementsByClassName( 'hostname' );
    var textLabels = document.getElementsByClassName( 'label' );

    for (i = 0; i < textHostnames.length; i++) {
        if (textHostnames[i].value !== '' && textLabels[i].value !== '') {
            let hostname = {};
            hostname[textHostnames[i].value] = textLabels[i].value;
            chrome.storage.sync.set(hostname);
        }
    }

    var status = document.getElementById( 'status');
    status.textContent = 'Markers saved.';
    setTimeout(function() {
      status.textContent = '';
    }, 750);
}

function restore_options() {
    chrome.storage.sync.get(null, function(items) {
        for (item in items) {
            add_line(item, items[item]);
        }

        let addButtonField = document.createElement( 'button' );
        addButtonField.id = "add";
        addButtonField.textContent = "+";

        document.getElementById( 'wrapper' ).appendChild( addButtonField );
    });
}

function add_line(hostname=null, label=null) {
    let hostnameLabel = document.createElement( 'label' );
    hostnameLabel.textContent = "Hostname:";
    hostnameLabel.dataset.id = count;

    let hostnameField = document.createElement( 'input' );
    hostnameField.type = "text";
    hostnameField.name = "hostname[]";
    hostnameField.placeholder = "dev.example.com";
    hostnameField.className = "hostname";
    hostnameField.required = true;
    hostnameField.value = hostname;
    hostnameField.dataset.id = count;

    let labelLabel = document.createElement( 'label' );
    labelLabel.textContent = "Label:";
    labelLabel.dataset.id = count;

    let labelField = document.createElement( 'input' );
    labelField.type = "text";
    labelField.name = "label[]";
    labelField.placeholder = "DEV";
    labelField.className = "label";
    labelField.required = true;
    labelField.value = label;
    labelField.dataset.id = count;

    let br = document.createElement( 'br' );
    br.dataset.id = count;

    document.getElementById( 'wrapper' ).appendChild( br );
    document.getElementById( 'wrapper' ).appendChild( br );
    document.getElementById( 'wrapper' ).appendChild( hostnameLabel );
    document.getElementById( 'wrapper' ).appendChild( hostnameField );
    document.getElementById( 'wrapper' ).appendChild( labelLabel );
    document.getElementById( 'wrapper' ).appendChild( labelField );

    let delButtonField = document.createElement( 'button' );
    delButtonField.id = "del";
    delButtonField.textContent = "-";
    delButtonField.dataset.id = count;

    document.getElementById( 'wrapper' ).appendChild( delButtonField );

    if (hostname === null && label === null) {
        document.getElementById('add').remove();

        let addButtonField = document.createElement( 'button' );
        addButtonField.id = "add";
        addButtonField.textContent = "+";

        document.getElementById( 'wrapper' ).appendChild( addButtonField );
    }

    count++;
}

function del_line(id) {
    document.querySelectorAll( '[data-id="' + id + '"]' ).forEach(element => {
        element.remove();
    });
}

document.addEventListener( 'DOMContentLoaded' , restore_options);
document.getElementById( 'save' ).addEventListener( 'click' , save_options);
document.addEventListener( 'click' , function(e) {
    if ( e.target && e.target.id === 'add'){
        add_line();
    }
});
document.addEventListener( 'click' , function(e) {
    if ( e.target && e.target.id === 'del'){
        del_line(e.target.dataset.id);
    }
});