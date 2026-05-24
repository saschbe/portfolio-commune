// Affiche le nom de l'image sélectionnée dans le formulaire
document.getElementById('file-upload').addEventListener('change', function() {
    let fileName = this.files[0] ? this.files[0].name : "Aucun fichier sélectionné";
    document.getElementById('file-name-preview').textContent = fileName;
});