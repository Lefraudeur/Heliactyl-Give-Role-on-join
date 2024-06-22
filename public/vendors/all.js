(function($) {
    'use strict';
    $(function() {
        var $body = $("body");
        var $navbar = $(".navbar");
        var $tiles = $(".tiles");
        var $sidebar = $(".sidebar");
        var $sidebarOptions = $(".sidebar-bg-options");
        var sidebarClasses = "sidebar-light sidebar-dark";
        var navbarClasses = "navbar-danger navbar-success navbar-warning navbar-dark navbar-light navbar-primary navbar-info navbar-pink";

        // Toggle classes
        function toggleClassOnClick(selector, className) {
            $(selector).on("click", function() {
                $(this).toggleClass(className);
            });
        }

        // Remove classes and add selected class
        function handleThemeChange(buttonSelector, classesToRemove, classToAdd) {
            $(buttonSelector).on("click", function() {
                $body.removeClass(classesToRemove).addClass(classToAdd);
                $sidebarOptions.removeClass("selected");
                $(this).addClass("selected");
            });
        }

        // Initialize sidebar theme handlers
        handleThemeChange("#sidebar-default-theme", sidebarClasses, "");
        handleThemeChange("#sidebar-dark-theme", sidebarClasses, "sidebar-dark");

        // Initialize navbar theme handlers
        $tiles.on("click", function() {
            var theme = $(this).data("theme");
            $navbar.removeClass(navbarClasses).addClass(theme);
            $tiles.removeClass("selected");
            $(this).addClass("selected");
        });

        // Initialize miscellaneous handlers
        toggleClassOnClick(".nav-settings", "open");
        toggleClassOnClick("#settings-trigger", "open");
        $(".settings-close").on("click", function() {
            $("#right-sidebar,#theme-settings").removeClass("open");
        });

        $('[data-toggle="horizontal-menu-toggle"]').on("click", function() {
            $(".horizontal-menu .bottom-navbar").toggleClass("header-toggled");
        });

        var navItemClicked = $('.horizontal-menu .page-navigation > .nav-item');
        navItemClicked.on("click", function() {
            if (window.matchMedia('(max-width: 991px)').matches) {
                if (!($(this).hasClass('show-submenu'))) {
                    navItemClicked.removeClass('show-submenu');
                }
                $(this).toggleClass('show-submenu');
            }
        });

        $(window).scroll(function() {
            if (window.matchMedia('(min-width: 992px)').matches) {
                var header = $('.horizontal-menu');
                $(header).toggleClass('fixed-on-scroll', $(window).scrollTop() >= 71);
            }
        });

        function addActiveClass(element) {
            var current = location.pathname.split("/").slice(-1)[0].replace(/^\/|\/$/g, '');
            var href = element.attr('href');
            if ((current === "" && href.indexOf("index.html") !== -1) || href.indexOf(current) !== -1) {
                element.parents('.nav-item').last().addClass('active');
                if (element.parents('.sub-menu').length) {
                    element.closest('.collapse').addClass('show').end().addClass('active');
                }
                if (element.parents('.submenu-item').length) {
                    element.addClass('active');
                }
            }
        }

        $('.nav li a', $sidebar).each(function() {
            addActiveClass($(this));
        });

        $('.horizontal-menu .nav li a').each(function() {
            addActiveClass($(this));
        });

        $sidebar.on('show.bs.collapse', '.collapse', function() {
            $sidebar.find('.collapse.show').collapse('hide');
        });

        function applyStyles() {
            if (!$body.hasClass("rtl")) {
                if ($('.settings-panel .tab-content .tab-pane.scroll-wrapper').length) {
                    new PerfectScrollbar('.settings-panel .tab-content .tab-pane.scroll-wrapper');
                }
                if ($('.chats').length) {
                    new PerfectScrollbar('.chats');
                }
                if ($body.hasClass("sidebar-fixed")) {
                    new PerfectScrollbar('#sidebar .nav');
                }
            }
        }

        applyStyles();

        $('[data-toggle="minimize"]').on("click", function() {
            $body.toggleClass(($body.hasClass('sidebar-toggle-display') || $body.hasClass('sidebar-absolute')) ? 'sidebar-hidden' : 'sidebar-icon-only');
        });

        $(".form-check label,.form-radio label").append('<i class="input-helper"></i>');

        $("#fullscreen-button").on("click", function() {
            if (!document.fullscreenElement && !document.msFullscreenElement && !document.mozFullScreen && !document.webkitIsFullScreen) {
                var docEl = document.documentElement;
                (docEl.requestFullscreen || docEl.mozRequestFullScreen || docEl.webkitRequestFullscreen || docEl.msRequestFullscreen).call(docEl);
            } else {
                (document.exitFullscreen || document.mozCancelFullScreen || document.webkitExitFullscreen || document.msExitFullscreen).call(document);
            }
        });

        $(document).on('mouseenter mouseleave', '.sidebar .nav-item', function(ev) {
            var isIconOnly = $body.hasClass("sidebar-icon-only");
            var isFixed = $body.hasClass("sidebar-fixed");
            if (!('ontouchstart' in document.documentElement) && isIconOnly) {
                if (isFixed && ev.type === 'mouseenter') {
                    $body.removeClass('sidebar-icon-only');
                } else {
                    $(this).toggleClass('hover-open', ev.type === 'mouseenter');
                }
            }
        });

        $('[data-toggle="offcanvas"]').on("click", function() {
            $('.sidebar-offcanvas').toggleClass('active');
        });
    });
})(jQuery);