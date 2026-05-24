// Affiche le nom de l'image sélectionnée dans le formulaire
document.getElementById('file-upload').addEventListener('change', function() {
    let fileName = this.files[0] ? this.files[0].name : "Aucun fichier sélectionné";
    document.getElementById('file-name-preview').textContent = fileName;
});

// Attendre que le fichier soit sélectionné
document.getElementById('file-upload').addEventListener('change', function() {
    // Si un fichier existe, on prend son nom, sinon on remet le texte par défaut
    let fileName = this.files[0] ? this.files[0].name : "Aucun fichier sélectionné";
    
    // On l'injecte dans la zone de texte sous le bouton
    document.getElementById('file-name-preview').textContent = fileName;
});