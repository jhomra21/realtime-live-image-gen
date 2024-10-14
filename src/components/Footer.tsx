import { Component } from 'solid-js';

const Footer: Component = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer class=" text-center text-gray-400 bg-gray-900 my-10 pt-16">
      <p>&copy; {currentYear} AI Image Generator. All rights reserved.</p>
    </footer>
  );
};

export default Footer;
