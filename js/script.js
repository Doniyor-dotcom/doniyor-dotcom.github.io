$(document).ready(function () {
  let hamburger = document.querySelector(".promo__hamburger"),
    menu = document.querySelector(".promo__menu"),
    links = document.querySelectorAll(".promo__list li");

  hamburger.addEventListener("click", function () {
    hamburger.classList.toggle("promo__hamburger_active");
    menu.classList.toggle("promo__menu_active");
  });

  links.forEach(item => {
    item.addEventListener("click", () => {
      hamburger.classList.remove("promo__hamburger_active");
      menu.classList.remove("promo__menu_active");
    });
  });

  let a = document.querySelector("#scrollBtn");

  window.addEventListener("scroll", function () {
    if (document.body.scrollTop > 1000 || document.documentElement.scrollTop > 1000) {
      a.style.display = "block";
    } else {
      a.style.display = "none";
    }
  });
  
  a.addEventListener("click", function () {
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;
  });

  $(".clients__slider").slick({
    adaptiveHeight: true,
    prevArrow: '<button type="button" class="slick-prev"><img src="icons/left.png" alt="prev"></button>',
    nextArrow: '<button type="button" class="slick-next"><img src="icons/right.png" alt="next"></button>',
  });

  function validateForms(form) {
    $(form).validate({
      rules: {
        name: {
          required: true,
          minlength: 2
        },
        phone: "required",
        email: {
          required: true,
          email: true
        },
        text: {
          required: true,
          minlength: 2
        }
      }
    });
  }

  validateForms(".price__form");
  validateForms(".question__form");

  $("input[name=phone]").mask("+7 (999) 999-99-99");

  $("form").submit(function (e) {
    e.preventDefault();
    $.ajax({
      type: "POST",
      url: "mailer/smart.php",
      data: $(this).serialize()
    }).done(function () {
      $(this).find("input").val("");
      $(this).find("textarea").val("");
      $(".success").addClass("success_active");
      $("form").trigger("reset");
      setTimeout(function () {
        $(".success").removeClass("success_active");
      }, 3000);
    });
    return false;
  });
});