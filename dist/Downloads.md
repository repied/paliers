---
title: Downloads
---

<ul>
  {% for file in site.static_files %}
    {% if file.path contains '/dist/' %}
      <li><a href="{{ file.path }}">{{ file.path }}</a></li>
    {% endif %}
  {% endfor %}
</ul>
