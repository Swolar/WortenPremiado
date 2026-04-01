
document.addEventListener('DOMContentLoaded', () => {
    if (typeof SITE_CONTENT === 'undefined') {
        console.error("SITE_CONTENT not loaded. Check js/content.js");
        return;
    }

    const c = SITE_CONTENT;

    // --- General ---
    const logoImgs = document.querySelectorAll('.dynamic-logo-img');
    logoImgs.forEach(img => img.src = c.general.logo);

    const categoryEls = document.querySelectorAll('.dynamic-category');
    categoryEls.forEach(el => el.innerText = c.general.category);

    const titleEls = document.querySelectorAll('.dynamic-title');
    titleEls.forEach(el => el.innerText = c.general.title);

    const idEls = document.querySelectorAll('.dynamic-campaign-id');
    idEls.forEach(el => el.innerText = `ID: ${c.general.campaignId}`);

    const bannerEls = document.querySelectorAll('.dynamic-banner-img');
    bannerEls.forEach(img => img.src = c.general.banner);

    // --- Metrics ---
    // Update all elements displaying the raised amount
    const raisedEls = document.querySelectorAll('.dynamic-raised');
    raisedEls.forEach(el => el.innerText = c.metrics.raised);

    // Update goal
    const goalEls = document.querySelectorAll('.dynamic-goal');
    goalEls.forEach(el => el.innerText = c.metrics.goal); // Usually "de € 100.000,00" in span

    // Update percentage text and bars
    const percentEls = document.querySelectorAll('.dynamic-percentage');
    percentEls.forEach(el => el.innerText = c.metrics.percentage);

    const progressBars = document.querySelectorAll('.dynamic-progress-bar');
    progressBars.forEach(el => el.style.width = c.metrics.percentage);

    // Update supporters
    const supportersEls = document.querySelectorAll('.dynamic-supporters');
    supportersEls.forEach(el => el.innerText = c.metrics.supporters);


    // --- Story Section ---
    // We map specific IDs for the story parts
    if(document.getElementById('story-title-1')) document.getElementById('story-title-1').innerText = c.story.section1.title;
    if(document.getElementById('story-text-1')) document.getElementById('story-text-1').innerText = c.story.section1.text;

    if(document.getElementById('story-title-2')) document.getElementById('story-title-2').innerText = c.story.section2.title;
    if(document.getElementById('story-text-2')) document.getElementById('story-text-2').innerText = c.story.section2.text;

    if(document.getElementById('story-title-3')) document.getElementById('story-title-3').innerText = c.story.section3.title;
    if(document.getElementById('story-text-3')) document.getElementById('story-text-3').innerText = c.story.section3.text;

    if(document.getElementById('story-title-4')) document.getElementById('story-title-4').innerText = c.story.section4.title;
    if(document.getElementById('story-text-4')) document.getElementById('story-text-4').innerText = c.story.section4.text;

    if(document.getElementById('story-cta')) document.getElementById('story-cta').innerText = c.story.callToAction;


    // --- Comments ---
    const commentsContainer = document.getElementById('comments-list');
    if (commentsContainer && c.comments && c.comments.length > 0) {
        // Update header count if exists
        const countHeader = document.querySelector('.comments-count-header');
        if(countHeader) countHeader.innerText = `A mostrar ${c.comments.length} Comentário(s)`;

        let html = '';
        c.comments.forEach(comment => {
            html += `
            <div class="comentario">
                <div class="content-comentario">
                    <div class="avatar">
                        <img src="${comment.avatar}" alt="${comment.name}">
                    </div>
                    <div class="text-comentario">
                        <h3>${comment.name}</h3>
                        <p>${comment.text}</p>
                        <div class="d-flex align-items-center">
                            <span>Responder</span><span>Gostar</span><span>Seguir</span><span>${comment.time}</span>
                        </div>
                    </div>
                </div>
            </div>`;
        });
        commentsContainer.innerHTML = html;
    }
});
