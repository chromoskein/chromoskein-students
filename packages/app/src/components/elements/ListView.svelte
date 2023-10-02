<script lang="ts">
  import type { IListItem } from "./shared";
  
  export let items: IListItem[];
</script>

<ul>
  {#each items as item}
    <li><span class="text">{item.text}</span></li>
  {/each}
</ul>

<style>
  ul {
    font-size: 16px;
    font-weight: normal;

    box-sizing: border-box;
  }

  ul li {
    width: 100%;
    height: 32px;
    list-style: none;

    display: flex;
    align-items: center;

    padding-left: 16px;
    padding-right: 16px;

    background-color: rgb(30, 30, 30);
  }

  ul li:hover {
    padding-left: 13px;
    border-left: 3px solid royalblue;
    background-color: rgb(60, 60, 60);
  }

  ul li span.text {
    flex-grow: 1;
    font-size: 14px;
    line-height: 16px;
    height: 16px;
  }
</style>
