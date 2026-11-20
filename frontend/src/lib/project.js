export async function create(project_name) {
	const response = await fetch(
		`/projects/api/create/${encodeURIComponent(project_name)}`, {method: 'POST'}
	);
	if (!response.ok) {
		throw new Error(
			await response.text() || 'Could not create project'
		);
	}
};

export async function remove(project_name) {
	const response = await fetch(
		`/projects/api/delete/${encodeURIComponent(project_name)}`, {method: 'POST'}
	);
	if (!response.ok) {
		throw new Error(
			await response.text() || 'Could not delete project'
		);
	}
};

export async function duplicate(project_name) {
	const response = await fetch(
		`/projects/api/duplicate/${encodeURIComponent(project_name)}`, {method: 'POST'}
	);
	if (!response.ok) {
		throw new Error(
			await response.text() || 'Could not duplicate project'
		);
	}
};

export async function rename(project_name, new_name) {
	const response = await fetch(
		`/projects/api/rename/${encodeURIComponent(project_name)}/${encodeURIComponent(new_name)}`, {method: 'POST'}
	);
	if (!response.ok) {
		throw new Error(
			await response.text() || 'Could not rename project'
		);
	}
};

export async function save() {
	const response = await fetch(
		`/projects/api/save`, {method: 'POST'}
	);
	if (!response.ok) {
		throw new Error(
			await response.text() || 'Could not save project'
		);
	}
};

export async function close() {
	const response = await fetch(
		`/projects/api/close`, {method: 'POST'}
	);
	if (!response.ok) {
		throw new Error(
			await response.text() || 'Could not close project'
		);
	}
};

export async function open(project_name) {
	const response = await fetch(
		`/projects/api/open/${encodeURIComponent(project_name)}`, {
			method: 'POST'
		}
	);
	if (!response.ok) {
		throw new Error(
			await response.text() || 'Could not load project'
		);
	}
};
export async function installComponent(component_name) {
	const response = await fetch(
		`/projects/api/add_components`, {
			method: 'POST', 
			 headers: {"Content-Type": "application/json"}, 
			 body: JSON.stringify([component_name])
		}
	);
	if (!response.ok) {
		throw new Error(
			await response.text() || ( 'Could not install component ' + component_name )
		);
	}
};

export async function unInstallComponent(component_name) {
	const response = await fetch(
		`/projects/api/delete_component/${encodeURIComponent(component_name)}`, {
			method: 'POST',
		}
	);
	if (!response.ok) {
		throw new Error(
			await response.text() || ( 'Could not uninstall component ' + component_name )
		);
	}
};

export async function fetchProjectList( { signal } = {} ) {
	const response = await fetch('/projects/api/list', {
		signal,
	});

	if (!response.ok) {
		throw new Error('Error while fetching project list');
	}

	return response.json();
}


export async function getAutostart( { signal } = {} ) {
	const response = await fetch('/projects/api/autostart', {
		signal,
	});

	if (!response.ok) {
		throw new Error('Error while fetching current autostarting project');
	}

	return response.json();
}


export async function setAutostart( project_name ) {
	const response = await fetch(`/projects/api/autostart/set/${encodeURIComponent(project_name)}`, {method:"POST"} );

	if (!response.ok) {
		throw new Error(
			await response.text() || 'Could not set project autostart'
		);
	}
}

export async function clearAutostart() {
	const response = await fetch(`/projects/api/autostart/clear`, {method:"POST"} );

	if (!response.ok) {
		throw new Error(
			await response.text() || 'Could not clear autostart'
		);
	}
}




