import { Component } from 'solid-js';

const Footer: Component = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer class="mt-auto py-6 bg-gray-900 text-center text-gray-400 w-full">
      <p>&copy; {currentYear} AI Image Generator. All rights reserved.</p>
    </footer>
  );
};

export default Footer;
