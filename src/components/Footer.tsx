import { Component } from 'solid-js';

const Footer: Component = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer class="py-6 text-center text-gray-400">
      <p>&copy; {currentYear} AI Image Generator. All rights reserved.</p>
    </footer>
  );
};

export default Footer;
